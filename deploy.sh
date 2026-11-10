#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
用法：bash deploy.sh（输入镜像包文件名，再自动识别包内镜像版本）
兼容：./deploy.sh <镜像包.tar.gz或.tar> <镜像名:固定版本>
示例：./deploy.sh projectmate-1.0.0.tar.gz projectmate:1.0.0
先导入本地镜像包，再部署指定版本；不拉取镜像、不接受latest。
已有本地镜像可用：./deploy.sh projectmate:1.0.0 --local
可选：PROJECTMATE_ENV_FILE、PROJECTMATE_PORT、COMPOSE_PROJECT_NAME。
HELP
}
if [[ ${1:-} == --help || ${1:-} == -h ]]; then usage; exit 0; fi
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
archive=""
image=""
if [[ $# -eq 0 ]]; then
  printf '请输入镜像包文件名（.tar/.tar.gz，可填写绝对路径）：' >&2
  if ! IFS= read -r archive || [[ -z $archive ]]; then
    echo '未输入镜像包文件名，未执行部署。' >&2; exit 2
  fi
elif [[ $# -eq 2 ]]; then
  if [[ $2 == --local ]]; then image=$1; else archive=$1; image=$2; fi
else
  usage >&2; exit 2
fi
if [[ -n $archive ]]; then
  # Prefer the caller's current directory, then the script's release directory.
  if [[ $archive != /* && ! -f $archive && -f "$root/$archive" ]]; then archive="$root/$archive"; fi
  if [[ ! -f $archive || ! -r $archive ]]; then echo "无法读取镜像包：$archive" >&2; exit 2; fi
  case "$archive" in *.tar.gz|*.tgz|*.tar) ;; *) echo '镜像包必须为.tar.gz、.tgz或.tar。' >&2; exit 2;; esac
fi
validate_image() {
  local candidate=$1 tag=${1##*:}
  if [[ ! $candidate =~ ^[a-z0-9][a-z0-9./:_-]*:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ || ${candidate##*/} != *:* || $tag =~ ^[Ll][Aa][Tt][Ee][Ss][Tt]$ ]]; then
    echo '必须指定带固定版本的镜像标签，不能使用 latest。' >&2; return 1
  fi
}
if [[ -n $image ]]; then validate_image "$image" || exit 2; fi
command -v docker >/dev/null || { echo '请先安装 Docker 及 Compose 插件。' >&2; exit 1; }
env_file=${PROJECTMATE_ENV_FILE:-$root/.env}
if [[ $env_file != /* ]]; then env_file="$PWD/$env_file"; fi
if [[ ! -e $env_file ]]; then
  if [[ -n ${PROJECTMATE_ENV_FILE:-} ]]; then echo "指定的配置文件不存在：$env_file" >&2; exit 1; fi
  command -v openssl >/dev/null || { echo '首次部署需要 openssl 生成 AUTH_SECRET。' >&2; exit 1; }
  secret=$(openssl rand -hex 32)
  # 仅首次创建；已有配置（包括升级时的密钥）绝不覆盖。
  (umask 077; set -o noclobber; AUTH_SECRET_VALUE="$secret" awk '
    /^AUTH_SECRET=/ {print "AUTH_SECRET=" ENVIRON["AUTH_SECRET_VALUE"]; next}
    {print}
  ' "$root/.env.example" > "$env_file")
  echo "已创建 $env_file 并生成随机 AUTH_SECRET。"
  if [[ -t 0 ]]; then
    read -r -p '请输入网站对外地址（例如 https://example.com）：' public_url
    if [[ ! $public_url =~ ^https?://[^[:space:]]+$ ]]; then echo '地址无效，请编辑 .env 的 AUTH_URL 后重新运行。' >&2; exit 2; fi
    updated_env=$(mktemp "$root/.env.XXXXXX")
    AUTH_URL_VALUE="$public_url" awk '/^AUTH_URL=/ {print "AUTH_URL=" ENVIRON["AUTH_URL_VALUE"]; next} {print}' "$env_file" > "$updated_env"
    chmod 600 "$updated_env"
    mv "$updated_env" "$env_file"
  else
    echo '请编辑 .env 的 AUTH_URL（以及 AI 等可选配置），然后重新执行 bash deploy.sh。' >&2
    exit 1
  fi
fi
if [[ ! -f $env_file || ! -r $env_file ]]; then echo "无法读取配置文件：$env_file" >&2; exit 1; fi
if ! grep -Eq '^AUTH_SECRET=.+$' "$env_file" || grep -Eq "^AUTH_SECRET=['\"]?(change-me)?['\"]?$" "$env_file"; then
  echo '请在配置中设置有效的随机 AUTH_SECRET。' >&2; exit 2
fi
if ! grep -Eq "^AUTH_URL=['\"]?https?://[^[:space:]]+" "$env_file"; then
  echo '请在配置中设置有效的 AUTH_URL。' >&2; exit 2
fi
port=${PROJECTMATE_PORT:-3000}
if [[ ! $port =~ ^[0-9]{1,5}$ ]] || (( 10#$port < 1 || 10#$port > 65535 )); then echo 'PROJECTMATE_PORT 必须是 1 到 65535 的端口号。' >&2; exit 2; fi
project_name=${COMPOSE_PROJECT_NAME:-projectmate}
if [[ ! $project_name =~ ^[a-z0-9][a-z0-9_-]*$ ]]; then echo 'COMPOSE_PROJECT_NAME 格式无效。' >&2; exit 2; fi
export PROJECTMATE_IMAGE="${image:-projectmate:pending-validation}" PROJECTMATE_ENV_FILE="$env_file" PROJECTMATE_PORT="$port"
compose=(docker compose --project-name "$project_name" --project-directory "$root" --env-file "$env_file" --file "$root/docker-compose.deploy.yml")
docker info >/dev/null
"${compose[@]}" version >/dev/null
"${compose[@]}" config --quiet
if [[ -n $archive ]]; then
  case "$archive" in *.tar.gz|*.tgz) gzip -t -- "$archive" ;; esac
  loaded=$(docker image load --input "$archive")
  printf '%s\n' "$loaded"
  if [[ -z $image ]]; then
    loaded_images=()
    while IFS= read -r candidate; do
      [[ -n $candidate ]] && loaded_images+=("$candidate")
    done < <(printf '%s\n' "$loaded" | sed -n 's/^Loaded image: //p' | sort -u)
    if [[ ${#loaded_images[@]} -eq 0 ]]; then
      echo '镜像包没有可识别的版本标签，未重建服务。请重新导出带版本的镜像。' >&2; exit 1
    elif [[ ${#loaded_images[@]} -eq 1 ]]; then
      image=${loaded_images[0]}
      printf '已识别镜像：%s\n' "$image"
    else
      printf '镜像包中存在多个标签，请输入要部署的完整标签：\n' >&2
      printf '  %s\n' "${loaded_images[@]}" >&2
      printf '镜像标签：' >&2
      if ! IFS= read -r image || [[ -z $image ]]; then echo '未选择镜像，未重建服务。' >&2; exit 2; fi
    fi
    validate_image "$image" || exit 2
  fi
  if ! printf '%s\n' "$loaded" | grep -Fqx "Loaded image: $image"; then
    echo "镜像包未包含指定标签：$image；未重建服务。" >&2; exit 1
  fi
fi
# Verify the exact requested tag; never silently deploy an old pre-existing tag.
# Offline archives must be trusted and contain the expected version.
# Docker's load output lists all loaded tags; archives from build.sh contain one image.
export PROJECTMATE_IMAGE="$image"
"${compose[@]}" config --quiet
docker image inspect "$image" >/dev/null
printf '部署镜像：%s；端口：%s；Compose 项目：%s\n' "$image" "$port" "$project_name"
# 不执行 down -v；升级与回退均复用同一命名卷中的数据库和上传文件。
if ! "${compose[@]}" up --detach --no-build --pull never --wait --wait-timeout 180 web; then
  "${compose[@]}" ps web || true
  "${compose[@]}" logs --tail 80 web >&2 || true
  echo '部署未通过健康检查；请检查上述日志。已有数据卷保留。' >&2
  exit 1
fi
"${compose[@]}" ps web
printf '部署完成。请确认 .env 中 AUTH_URL 与实际访问域名一致。\n'
