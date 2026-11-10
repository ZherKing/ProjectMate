# Docker 构建和部署

需要 Docker Engine 和支持 `up --wait` 的 Docker Compose 插件。镜像使用项目的 `package-lock.json` 执行 `npm ci`，包括 SQLite 本地模块编译工具；运行镜像不包含这些编译工具。

## 构建指定版本

```sh
./build.sh 1.0.0 ghcr.io/your-name/projectmate
# 推送由你显式执行；build.sh 不会自动推送
docker push ghcr.io/your-name/projectmate:1.0.0
```

省略仓库时使用 `projectmate:1.0.0`。禁止 `latest`，每次发布使用新版本标签。构建不会读取或打包 `.env`、数据库、上传文件及本地 `.next-*` 缓存。

## 在服务器部署

将 `deploy.sh`、`docker-compose.deploy.yml` 和服务器 `.env` 放在同一目录。首次部署先参考 `.env.example` 创建 `.env`，设置独立的 `AUTH_SECRET`、实际外部 `AUTH_URL`，以及需要的 AI、SMTP/第三方服务配置。

```sh
./deploy.sh ghcr.io/your-name/projectmate:1.0.0
```

脚本会拉取这个固定版本，只启动 `web` 服务，等待 HTTP 健康检查通过后返回成功。拉取、配置校验或健康检查失败会返回非零退出码。健康检查证明应用 HTTP 可访问，不代表 SMTP、AI 等外部服务已配置成功。

本机已经构建镜像时：

```sh
./build.sh 1.0.0
./deploy.sh projectmate:1.0.0 --local
```

可选覆盖：

```sh
PROJECTMATE_ENV_FILE=/srv/projectmate/.env \
PROJECTMATE_PORT=3000 \
COMPOSE_PROJECT_NAME=projectmate \
./deploy.sh ghcr.io/your-name/projectmate:1.0.0
```

默认 Compose 项目名是 `projectmate`，默认卷名是 `projectmate_projectmate-data`，数据库与文件分别位于容器 `/app/data/database.sqlite`、`/app/data/storage`。与旧默认项目名一致时可复用原 `docker-compose.yml` 的数据卷。若以前使用自定义 Compose 项目名，请继续传同一个 `COMPOSE_PROJECT_NAME`；改名会使用另一份卷，看起来像空网站。

部署会重建应用容器，可能短暂不可访问；脚本不执行删除数据卷或数据库的操作。首次把宿主机本地网站切到 Docker 时，本地 `database.sqlite` 不会自动迁移到卷。迁移、发布前备份和恢复应在停止写入后显式进行，不能拿运行中的 SQLite 文件直接覆盖。

回退代码版本：再次运行 `deploy.sh` 并指定旧镜像标签。数据卷继续保留；若某次升级含不兼容的数据变更，应结合发布前备份恢复，不能只回退镜像。不要执行 `docker compose down -v`，这会删除数据卷。

脚本不会自动执行公网部署、反向代理、TLS 或镜像仓库登录。私有仓库需事先 `docker login`；生产服务应通过 HTTPS 域名访问并配置 `AUTH_URL`。

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
