#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
用法：./deploy.sh <镜像包.tar.gz或.tar> <镜像名:固定版本>
示例：./deploy.sh projectmate-1.0.0.tar.gz projectmate:1.0.0
先导入本地镜像包，再部署指定版本；不拉取镜像、不接受latest。
已有本地镜像可用：./deploy.sh projectmate:1.0.0 --local
可选：PROJECTMATE_ENV_FILE、PROJECTMATE_PORT、COMPOSE_PROJECT_NAME。
HELP
}
if [[ ${1:-} == --help || ${1:-} == -h ]]; then usage; exit 0; fi
if [[ $# -ne 2 ]]; then usage >&2; exit 2; fi
archive=""
if [[ $2 == --local ]]; then
  image=$1
else
  archive=$1
  image=$2
  if [[ ! -f $archive || ! -r $archive ]]; then echo "无法读取镜像包：$archive" >&2; exit 2; fi
  case "$archive" in *.tar.gz|*.tgz|*.tar) ;; *) echo '镜像包必须为.tar.gz、.tgz或.tar。' >&2; exit 2;; esac
fi
tag=${image##*:}
if [[ ! $image =~ ^[a-z0-9][a-z0-9./:_-]*:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ || ${image##*/} != *:* || $tag =~ ^[Ll][Aa][Tt][Ee][Ss][Tt]$ ]]; then
  echo '必须指定完整镜像和固定版本，例如 ghcr.io/your-name/projectmate:1.0.0。' >&2; exit 2
fi
command -v docker >/dev/null || { echo '请先安装 Docker 及 Compose 插件。' >&2; exit 1; }
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
env_file=${PROJECTMATE_ENV_FILE:-$root/.env}
if [[ $env_file != /* ]]; then env_file="$PWD/$env_file"; fi
if [[ ! -f $env_file || ! -r $env_file ]]; then echo "无法读取配置文件：$env_file" >&2; exit 1; fi
port=${PROJECTMATE_PORT:-3000}
if [[ ! $port =~ ^[0-9]{1,5}$ ]] || (( 10#$port < 1 || 10#$port > 65535 )); then echo 'PROJECTMATE_PORT 必须是 1 到 65535 的端口号。' >&2; exit 2; fi
project_name=${COMPOSE_PROJECT_NAME:-projectmate}
if [[ ! $project_name =~ ^[a-z0-9][a-z0-9_-]*$ ]]; then echo 'COMPOSE_PROJECT_NAME 格式无效。' >&2; exit 2; fi
export PROJECTMATE_IMAGE="$image" PROJECTMATE_ENV_FILE="$env_file" PROJECTMATE_PORT="$port"
compose=(docker compose --project-name "$project_name" --project-directory "$root" --env-file "$env_file" --file "$root/docker-compose.deploy.yml")
docker info >/dev/null
"${compose[@]}" version >/dev/null
"${compose[@]}" config --quiet
if [[ -n $archive ]]; then
  case "$archive" in *.tar.gz|*.tgz) gzip -t -- "$archive" ;; esac
  loaded=$(docker image load --input "$archive")
  printf '%s\n' "$loaded"
  if ! printf '%s\n' "$loaded" | grep -Fqx "Loaded image: $image"; then
    echo "镜像包未包含指定标签：$image；未重建服务。" >&2; exit 1
  fi
fi
# Verify the exact requested tag; never silently deploy an old pre-existing tag.
# Offline archives must be trusted and contain the expected version.
# Docker's load output lists all loaded tags; archives from build.sh contain one image.
docker image inspect "$image" >/dev/null
printf '部署镜像：%s；端口：%s；Compose 项目：%s\n' "$image" "$port" "$project_name"
# 不执行 down -v；升级与回退均复用同一命名卷中的数据库和上传文件。
"${compose[@]}" up --detach --no-build --pull never --wait --wait-timeout 180 web
"${compose[@]}" ps web
printf '部署完成。请确认 .env 中 AUTH_URL 与实际访问域名一致。\n'
