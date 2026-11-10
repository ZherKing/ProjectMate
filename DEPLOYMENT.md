# Docker 构建和部署

需要 Docker Engine 和支持 `up --wait` 的 Docker Compose 插件。镜像使用项目的 `package-lock.json` 执行 `npm ci`，包括 SQLite 本地模块编译工具；运行镜像不包含这些编译工具。

## 构建并导出离线镜像包

```sh
./build.sh 1.0.0
```

默认构建 `projectmate:1.0.0`，目标平台 `linux/amd64`，然后执行 `docker image save` 并 gzip 压缩，生成 `artifacts/projectmate-1.0.0.tar.gz`。脚本不启动容器、不推送镜像，已有同名包时拒绝覆盖。压缩包只包含镜像，不包含数据库、上传文件或 `.env`。

ARM64 服务器需要显式指定：

```sh
PROJECTMATE_PLATFORM=linux/arm64 ./build.sh 1.0.0
```

可用第二参数自定义镜像名，例如 `./build.sh 1.0.0 myteam/projectmate`；输出目录由 `PROJECTMATE_OUTPUT_DIR` 指定。跨架构构建需要 Docker 的相应平台构建支持，依赖与基础镜像仍需在构建机下载。

## 上传到服务器并部署

将以下文件上传至服务器同一目录：

- `artifacts/projectmate-1.0.0.tar.gz`
- `deploy.sh`
- `docker-compose.deploy.yml`
- 服务器自己的 `.env`（首次参考 `.env.example` 创建，不将开发密钥直接公开）

```sh
# 本机执行：替换服务器账号、地址和目标路径
scp artifacts/projectmate-1.0.0.tar.gz deploy.sh docker-compose.deploy.yml user@server:/srv/projectmate/

# 服务器执行：先准备好 /srv/projectmate/.env
cd /srv/projectmate
chmod +x deploy.sh
./deploy.sh projectmate-1.0.0.tar.gz projectmate:1.0.0
```

脚本校验压缩包，执行 `docker image load`，确认归档包含指定标签后再启动 `web`，不拉取镜像。版本不匹配或导入失败时，不重建当前服务。仅导入你自己构建或信任的镜像包。目标机器须已安装 Docker Engine 和 Compose；无需克隆源码、安装 Node 或登录镜像仓库。

若镜像早已手动导入，也保留本地镜像模式：

```sh
./deploy.sh projectmate:1.0.0 --local
```

脚本等待 HTTP 健康检查；失败时返回非零退出码。健康检查只证明应用可访问，不代表 SMTP、AI 等服务已配置。部署会重建应用容器，可能短暂中断。部署不会删除数据卷。

可选覆盖：

```sh
PROJECTMATE_ENV_FILE=/srv/projectmate/.env \
PROJECTMATE_PORT=3000 \
COMPOSE_PROJECT_NAME=projectmate \
./deploy.sh projectmate-1.0.0.tar.gz projectmate:1.0.0
```

默认 Compose 项目名是 `projectmate`，默认卷名是 `projectmate_projectmate-data`，数据库与文件分别位于容器 `/app/data/database.sqlite`、`/app/data/storage`。与旧默认项目名一致时可复用原 `docker-compose.yml` 的数据卷。若以前使用自定义 Compose 项目名，请继续传同一个 `COMPOSE_PROJECT_NAME`；改名会使用另一份卷，看起来像空网站。

部署会重建应用容器，可能短暂不可访问；脚本不执行删除数据卷或数据库的操作。首次把宿主机本地网站切到 Docker 时，本地 `database.sqlite` 不会自动迁移到卷。迁移、发布前备份和恢复应在停止写入后显式进行，不能拿运行中的 SQLite 文件直接覆盖。

回退代码版本：上传旧版本镜像包，再运行 `deploy.sh 旧版本.tar.gz 镜像名:旧版本`。数据卷继续保留；若某次升级含不兼容的数据变更，应结合发布前备份恢复，不能只回退镜像。不要执行 `docker compose down -v`，这会删除数据卷。

脚本不配置反向代理或 TLS；生产服务应通过 HTTPS 域名访问并配置 `AUTH_URL`。离线部署不需要访问镜像仓库；构建阶段仍需要下载基础镜像与依赖。


## Docker 首次部署后的赛事数据准备

镜像不包含开发机的数据库，也不会在启动时自动抓取外部赛事。用管理员账号进入 `/admin/sources`，在“传智杯”等来源卡片点击“立即同步”；成功后到 `/admin` 审核新增赛事，通过后才会显示在公开比赛中心及来源筛选。错误与最近结果会保存在本站数据库，重复同步保留已有审核状态，抓取失败不删除已有数据。

传智杯接口地址 `BOXUEGU_TRACK_API_URL` 可留空使用默认公开地址。来源不可访问时，检查容器的 DNS、外网连接及配置，不能只看镜像部署成功。该入口需使用包含本轮功能的新镜像，重新构建并上传新版本压缩包后再部署，不会由旧镜像自动获得。

## 登录注册的人机验证

只在服务器 `.env` 中启用极验 4.0：

```ini
GEETEST_ENABLED=true
GEETEST_ID=极验控制台的32位验证ID
GEETEST_KEY=极验控制台的服务端密钥
```

默认 `false`，后台没有启用或修改密钥的入口。更改后需重建容器（重新执行指定版本的 `deploy.sh`）；密钥仅在服务端使用。登录、注册及登录邮箱验证码请求会弹出人机验证，GitHub 登录也先验证；已启用的 2FA 继续执行。启用但缺少配置、SDK加载失败或服务端二次验证不可用时，会拒绝继续认证。请先在极验控制台配置实际使用的站点并验收，再开启生产验证。

协议参考：[服务端二次校验](https://docs.geetest.com/gt4/apirefer/api/server)、[Web API](https://docs.geetest.com/gt4/apirefer/api/web)。

## 项目讨论记录

项目空间的“讨论空间”使用同一 SQLite 数据库长期保存消息，每 5 秒拉取新消息，历史按 30 条分批加载。只有项目当前成员可读写；退出或被移除后失去访问权限。容器升级继续复用数据卷，讨论记录随数据库一并保留。注销账号时，个人独立项目的讨论随项目清理，共享项目中的协作记录保留并显示“已注销用户”。
