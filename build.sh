#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
用法：./build.sh <版本号> [镜像仓库]
示例：./build.sh 1.0.0 ghcr.io/your-name/projectmate
默认仓库：projectmate。仅构建，不推送；不接受 latest。
HELP
}
if [[ ${1:-} == --help || ${1:-} == -h ]]; then usage; exit 0; fi
if [[ $# -lt 1 || $# -gt 2 ]]; then usage >&2; exit 2; fi
version=$1
repository=${2:-projectmate}
if [[ ! $version =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ || $version =~ ^[Ll][Aa][Tt][Ee][Ss][Tt]$ ]]; then
  echo '请指定有效的固定版本号，不能使用 latest。' >&2; exit 2
fi
if [[ ! $repository =~ ^[a-z0-9][a-z0-9./:_-]*$ || $repository == *'@'* || ${repository##*/} == *:* ]]; then
  echo '请填写不含版本标签的镜像仓库，例如 ghcr.io/your-name/projectmate。' >&2; exit 2
fi
command -v docker >/dev/null || { echo '请先安装 Docker。' >&2; exit 1; }
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
image="$repository:$version"
docker info >/dev/null
docker build --file "$root/Dockerfile" --tag "$image" --label "org.opencontainers.image.version=$version" "$root"
printf '镜像构建完成：%s\n' "$image"
printf '本机部署：./deploy.sh %s --local\n' "$image"
printf '远程服务器部署前请先 docker push %s\n' "$image"
