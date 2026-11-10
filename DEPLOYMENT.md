# Docker 构建和部署

需要 Docker Engine 和支持 `up --wait` 的 Docker Compose 插件。镜像使用项目的 `package-lock.json` 执行 `npm ci`，包括 SQLite 本地模块编译工具；运行镜像不包含这些编译工具。

## 构建并导出离线镜像包

```sh
./build.sh 1.0.0
```

默认构建 `projectmate:1.0.0`，目标平台 `linux/amd64`，通过 `docker image save` 导出 TAR，再生成 `artifacts/projectmate-1.0.0-amd64.zip`。已有同名 ZIP 时拒绝覆盖，不推送镜像或启动容器。构建机需安装 `zip`。

ZIP 解压后的内容：

```text
projectmate-1.0.0-amd64.tar  # Docker 镜像
release.txt                 # 构建时镜像标签与TAR名称记录，仅供参考
deploy.sh
docker-compose.deploy.yml
.env.example
DEPLOYMENT.md
```

发布包不包含开发机 `.env`、数据库或上传文件。本项目在运行时自动创建 SQLite 数据库和表，无需种子库；数据库、上传文件持久化到 Docker 命名卷。

ARM64 服务器需要显式指定：

```sh
PROJECTMATE_PLATFORM=linux/arm64 bash build.sh 1.0.0
```

可用第二参数自定义镜像名，例如 `bash build.sh 1.0.0 myteam/projectmate`；输出目录由 `PROJECTMATE_OUTPUT_DIR` 指定。跨架构构建需要 Docker 的相应平台构建支持，依赖与基础镜像仍需在构建机下载。

## 上传到服务器并部署

服务器须已安装 Docker Engine、支持 `up --wait` 的 Compose 插件、`unzip`；首次自动生成密钥需要 `openssl`。无需源码、Node.js 或镜像仓库账号。

```sh
# 本机：先在服务器创建 /srv/projectmate，替换账号与地址
scp artifacts/projectmate-1.0.0-amd64.zip user@server:/srv/projectmate/

# 服务器：每次都使用同一个部署目录
cd /srv/projectmate
unzip -o projectmate-1.0.0-amd64.zip
bash deploy.sh
```

首次部署会从 `.env.example` 创建权限为 `600` 的 `.env`，自动生成随机 `AUTH_SECRET`，并在交互终端询问网站对外地址 `AUTH_URL`。AI、GitHub 等可选配置可提前在 `.env` 中填写；已有 `.env` 不会被覆盖。无交互终端时，脚本创建配置后退出，提示编辑配置并重新运行。不要将 `AUTH_SECRET` 留为 `change-me`。

执行后提示输入镜像包文件名，例如 `projectmate-1.0.0-amd64.tar`；可以填写绝对路径，路径含空格也无需额外加引号。文件必须已上传并解压为 Docker 镜像归档，不能填写发布 ZIP。脚本校验文件后导入，自动识别包内唯一版本标签；存在多个标签时会列出并要求输入完整标签。`release.txt` 只供参考，不再决定要部署的文件。空输入、文件缺失、导入失败、无版本或标签不匹配时不重建服务。只导入自己构建或信任的镜像包。

升级时将新 ZIP 解压到**同一目录**，再次执行 `bash deploy.sh`；只覆盖发布文件，保留服务器 `.env`。保持同一个 Compose 项目名，数据库和上传文件继续使用原数据卷。不要为了升级删除数据卷，也不要直接用开发库覆盖生产库。更换部署目录时，应明确通过 `PROJECTMATE_ENV_FILE` 指向原服务器配置。

兼容原来的显式参数方式（包含旧版 `.tar.gz` 包）：

```sh
bash deploy.sh projectmate-1.0.0-amd64.tar projectmate:1.0.0
bash deploy.sh projectmate-1.0.0.tar.gz projectmate:1.0.0
```

若镜像早已手动导入，也保留本地镜像模式：

```sh
./deploy.sh projectmate:1.0.0 --local
```

脚本等待 HTTP 健康检查；失败时输出容器状态和最近日志，并返回非零退出码。健康检查只证明应用可访问，不代表 SMTP、AI 等服务已配置。部署会重建应用容器，可能短暂中断。部署不会删除数据卷。

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


### Docker 评审演示账号与数据

镜像包含可选演示数据初始化器，**默认关闭**。在服务器 `.env` 中设置：

```ini
DEMO_DATA_ENABLED=true
DEMO_ACCOUNT_EMAIL=judge@projectmate.local
DEMO_ACCOUNT_PASSWORD=替换为你自己设置的12至128位密码
```

部署包含此功能的新版本镜像并重建容器后，会导入普通权限的评审账号及以下内容，不需要进入容器执行 tsx，也不会把账号密码固化进镜像：

- 8 场带“【演示】”标记的虚构赛事，16 条示例赛道；5 个收藏。
- 3 个可切换协作项目（2 个为创建者，1 个为成员）和另外 6 个招募项目，含岗位、时间、人数状态。
- 7 位虚构成员、36 项待办、64 条讨论、2 条待处理入队申请。
- 3 份文档、3 个代码文件和文档历史版本；预置教练报告及4条站内通知。

这些记录仅用于评审体验，不代表真实赛事、人员、模型输出或成果；不会调用 AI、发送邮件或 Webhook。真实传智杯赛事仍通过管理员同步与审核流程获取，不会被演示数据覆盖。导入后，虚构赛事及招募项目对站内访客也可见。

首次导入会检查邮箱冲突，拒绝接管已有账号；演示邮箱不能加入 `ADMIN_EMAILS`。重复启动不重置密码、任务状态、讨论或评委修改。导入完成后可将 `DEMO_DATA_ENABLED=false` 并重建容器，已有演示数据保留。该开关不是清理/重置按钮，修改环境密码也不会重置已经创建的账号。

将邮箱与密码通过评审渠道交付，不在公开 README 发布真实密码。`.local` 邮箱只适合密码登录，不可收信；如需演示邮箱验证码功能，应使用你实际控制的邮箱。服务器日志仅报告导入状态，不输出密码；出现冲突、密码长度或文件权限错误时查看日志，应用不会用错误配置覆盖已有用户。

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

## EdgeOne + Nginx（无需源站证书）

仓库根目录的 `nginx.conf` 是**站点配置片段**，供宿主机 Nginx 的 `http` 块包含；不要用它直接覆盖 `/etc/nginx/nginx.conf`。它监听 HTTP 80，将请求代理至同一宿主机的 `127.0.0.1:3000`，兼容流式响应、MCP、WebSocket 与上传，不启用 Nginx 代理缓存。

1. 将 `server_name _;` 改成实际域名，如 `server_name example.com www.example.com;`。`_` 只是占位名称，不是通配匹配规则。
2. 若用 `PROJECTMATE_PORT` 改过宿主机端口，相应修改 `proxy_pass` 的端口。此配置假定 Nginx 在宿主机运行；若 Nginx 也在容器里，`127.0.0.1` 指向该 Nginx 容器，需改为共享网络中的应用服务地址。
3. 在 EdgeOne 设置该域名 HTTP 回源、回源端口 80，回源 Host 保持公网域名。HTTPS 在 EdgeOne 终止，边缘启用 HTTP 跳转 HTTPS；源站不配置证书，也不再做 HTTPS 跳转，以免回源循环。
4. 服务器 `.env` 中设置 `AUTH_URL=https://你的公网域名`。配置优先转发 EdgeOne 提供的合法 `X-Forwarded-Proto`，未提供时按公网 HTTPS 处理；不要改成源站的 `$scheme`，HTTP 回源不代表访客使用 HTTP。
5. EdgeOne 不要缓存登录/注册、API/MCP、设置、仪表盘、项目空间等动态或带身份的响应；最稳妥是只为 `/_next/static/*` 配置静态缓存，其他路径绕过缓存。流式接口的边缘超时也需满足实际请求时间。
6. 默认允许 25 MiB 请求体，覆盖应用默认 20 MiB 文件限制。提高 `.env` 的 `PROJECT_FILE_MAX_MB` 时，同步调整 Nginx 及 EdgeOne 上传限制，留出请求封装余量。

在服务器自行检查并加载（本次未自动执行）：

```sh
sudo cp nginx.conf /etc/nginx/conf.d/projectmate.conf
sudo nginx -t
# 仅在校验成功后执行
sudo systemctl reload nginx
```

先确认主配置在 `http` 块内包含 `/etc/nginx/conf.d/*.conf`，并处理已有同域名站点，避免重复路由。配置不包含默认站点删除操作。

这里没有盲目信任所有客户端 IP 头：源站日志中的 `$remote_addr` 仍是直连的 EdgeOne 节点地址。需要真实客户端 IP 时，应按 EdgeOne 官方说明，仅对受信回源 IP 范围配置 `set_real_ip_from` 与对应真实 IP 头，不能用 `0.0.0.0/0` 信任任意请求。源站访问限制也应在服务器防火墙或 EdgeOne 回源鉴权中配置。

Nginx 代理指令参考：[官方文档](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)。
