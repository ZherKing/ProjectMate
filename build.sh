#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'HELP'
用法：./build.sh <版本号> [镜像仓库]
示例：./build.sh 1.0.0 ghcr.io/your-name/projectmate
默认镜像名：projectmate。不推送、不部署；导出 artifacts/projectmate-版本号-架构.zip。
可选：PROJECTMATE_PLATFORM（默认 linux/amd64）、PROJECTMATE_OUTPUT_DIR。
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
platform=${PROJECTMATE_PLATFORM:-linux/amd64}
if [[ $platform != linux/amd64 && $platform != linux/arm64 ]]; then echo 'PROJECTMATE_PLATFORM 仅支持 linux/amd64 或 linux/arm64。' >&2; exit 2; fi
output_dir=${PROJECTMATE_OUTPUT_DIR:-$root/artifacts}
mkdir -p -- "$output_dir"
output_dir=$(cd -- "$output_dir" && pwd)
name="projectmate-$version-${platform#linux/}"
archive="$output_dir/$name.zip"
if [[ -e $archive ]]; then echo "输出包已存在，请使用新版本或移动旧文件：$archive" >&2; exit 2; fi
command -v zip >/dev/null || { echo '请先安装 zip。' >&2; exit 1; }
for file in deploy.sh docker-compose.deploy.yml .env.example DEPLOYMENT.md; do
  [[ -f "$root/$file" ]] || { echo "缺少发布文件：$file" >&2; exit 1; }
done
docker info >/dev/null
docker build --platform "$platform" --file "$root/Dockerfile" --tag "$image" --label "org.opencontainers.image.version=$version" "$root"
# 仅在完整打包成功后发布 ZIP；临时目录不包含本地配置或生产数据。
staging=$(mktemp -d "$output_dir/.projectmate-$version.XXXXXX")
trap 'rm -rf -- "$staging"' EXIT
mkdir "$staging/$name"
docker image save --output "$staging/$name/$name.tar" "$image"
[[ -s "$staging/$name/$name.tar" ]] || { echo '镜像导出为空。' >&2; exit 1; }
cp "$root/deploy.sh" "$root/docker-compose.deploy.yml" "$root/.env.example" "$root/DEPLOYMENT.md" "$staging/$name/"
printf '%s\n%s\n' "$image" "$name.tar" > "$staging/$name/release.txt"
(cd "$staging/$name" && zip -qr ../release.zip .)
# 使用不覆盖的硬链接发布，防止并发构建覆盖同名版本。
ln "$staging/release.zip" "$archive"
printf '发布包生成完成：%s\n目标平台：%s\n' "$archive" "$platform"
printf '上传 ZIP 到服务器，解压到固定部署目录，然后执行 bash deploy.sh。\n'
