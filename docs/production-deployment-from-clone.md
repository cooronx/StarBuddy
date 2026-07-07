# StarBuddy 生产部署教程：Docker 数据库 + 独立前后端

这份教程按下面的部署方式写：

- 数据库：PostgreSQL 跑在 Docker 容器里，使用 Docker volume 持久化数据
- 后端：NestJS API 跑在单独的 Docker 容器里
- 前端：Vite React 单独部署到 Vercel
- OAuth：GitHub OAuth App

数据库不暴露公网。后端和数据库加入同一个 Docker network，后端通过容器名 `starbuddy-postgres` 连接数据库。

## 上线速查

创建 Docker network：

```bash
docker network create starbuddy-net
```

启动数据库：

```bash
docker run -d \
  --name starbuddy-postgres \
  --restart unless-stopped \
  --network starbuddy-net \
  -e POSTGRES_USER=starbuddy \
  -e POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD \
  -e POSTGRES_DB=starbuddy \
  -v starbuddy-postgres-data:/var/lib/postgresql/data \
  postgres:16
```

后端构建和启动：

```bash
docker build -t starbuddy-api .
docker run -d \
  --name starbuddy-api \
  --restart unless-stopped \
  --network starbuddy-net \
  --env-file .env \
  -p 127.0.0.1:3000:3000 \
  starbuddy-api
```

前端在 Vercel 单独部署，环境变量：

```env
VITE_API_BASE_URL=https://YOUR_BACKEND_DOMAIN
```

后端健康检查：

```txt
https://YOUR_BACKEND_DOMAIN/health
```

## 0. 最终地址

你最终会有：

```txt
前端地址: https://YOUR_FRONTEND_DOMAIN
后端地址: https://YOUR_BACKEND_DOMAIN
GitHub OAuth Callback: https://YOUR_BACKEND_DOMAIN/auth/github/callback
```

前端只访问后端公网域名。数据库只允许后端容器访问，不需要公网端口。

## 1. 准备服务器

服务器需要：

- Ubuntu / Debian
- 一个公网 IP
- 已安装 Docker
- 后端公网域名已解析到这台服务器，比如 `api.example.com`

安装基础工具：

```bash
sudo apt update
sudo apt install -y git openssl
```

安装 Docker 可以参考 Docker 官方文档。安装完成后确认：

```bash
docker --version
```

## 2. Clone 项目

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/StarBuddy.git
cd StarBuddy
```

如果这是你本地改完还没推到 GitHub 的代码，先在本地提交并推送，再在服务器上 clone 或 pull。

## 3. 创建 Docker 网络

后端和数据库使用同一个私有 Docker network：

```bash
docker network create starbuddy-net
```

如果提示 network 已存在，可以忽略。

## 4. 启动 PostgreSQL Docker 容器

生成一个强密码，后面会同时用于数据库容器和后端 `DATABASE_URL`：

```bash
openssl rand -hex 24
```

这里建议用 hex，避免密码里出现需要在 URL 中转义的字符。

启动数据库：

```bash
docker run -d \
  --name starbuddy-postgres \
  --restart unless-stopped \
  --network starbuddy-net \
  -e POSTGRES_USER=starbuddy \
  -e POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD \
  -e POSTGRES_DB=starbuddy \
  -v starbuddy-postgres-data:/var/lib/postgresql/data \
  postgres:16
```

这里没有使用 `-p 5432:5432`，所以数据库不会暴露到公网。

验证数据库容器：

```bash
docker exec -it starbuddy-postgres psql -U starbuddy -d starbuddy -c "select now();"
```

能返回时间就说明数据库正常。

## 5. 生成生产密钥

生成 JWT secret：

```bash
openssl rand -base64 48
```

生成 GitHub token 加密密钥：

```bash
openssl rand -base64 32
```

第二个值用于：

```env
CREDENTIAL_ENCRYPTION_KEY=...
```

它必须是 base64 编码后的 32-byte key。

## 6. 创建后端 `.env`

在项目根目录创建 `.env`：

```bash
cp .env.example .env
nano .env
```

生产环境示例：

```env
NODE_ENV=production
DATABASE_URL=postgresql://starbuddy:REPLACE_WITH_STRONG_PASSWORD@starbuddy-postgres:5432/starbuddy?connection_limit=10&pool_timeout=20
JWT_SECRET=第 5 步生成的 JWT secret
CREDENTIAL_ENCRYPTION_KEY=第 5 步生成的 32-byte base64 key

GITHUB_OAUTH_CLIENT_ID=先留空，创建 GitHub OAuth App 后再填
GITHUB_OAUTH_CLIENT_SECRET=先留空，创建 GitHub OAuth App 后再填
GITHUB_OAUTH_CALLBACK_URL=https://YOUR_BACKEND_DOMAIN/auth/github/callback

WEB_APP_URL=https://YOUR_FRONTEND_DOMAIN
CORS_ORIGINS=https://YOUR_FRONTEND_DOMAIN
ADMIN_GITHUB_LOGINS=你的 GitHub login

STAR_TASKS_ENABLED=true
REPOSITORY_PROMOTION_ENABLED=true
GITHUB_REQUEST_TIMEOUT_MS=10000
CLEANUP_INTERVAL_MS=21600000

HOST=0.0.0.0
PORT=3000
```

这份 `.env` 会通过 `docker run --env-file .env` 传给容器，不要给值加双引号；Docker 会把引号也当作环境变量值的一部分。

注意 `DATABASE_URL` 的 host 是 `starbuddy-postgres`，这是数据库容器名。不要写 `127.0.0.1`，因为后端容器里的 `127.0.0.1` 指向后端容器自己。

先不知道前端域名也没关系，Vercel 部署完成后回来改：

```env
WEB_APP_URL
CORS_ORIGINS
```

## 7. 构建并启动后端 Docker

在项目根目录构建镜像：

```bash
docker build -t starbuddy-api .
```

启动后端容器：

```bash
docker run -d \
  --name starbuddy-api \
  --restart unless-stopped \
  --network starbuddy-net \
  --env-file .env \
  -p 127.0.0.1:3000:3000 \
  starbuddy-api
```

这里把后端端口只绑定到服务器本机 `127.0.0.1:3000`，再由 Nginx 或 Caddy 对外提供 HTTPS。

查看日志：

```bash
docker logs -f starbuddy-api
```

当前 Dockerfile 启动时会执行：

```bash
npx prisma migrate deploy && node dist/main.js
```

也就是先跑数据库迁移，再启动后端。

## 8. 配置反向代理和 HTTPS

后端容器监听：

```txt
http://127.0.0.1:3000
```

生产环境建议用 Nginx 或 Caddy 把你的后端域名代理到 3000，并配置 HTTPS。

### Caddy 示例

安装 Caddy 后，配置：

```caddyfile
YOUR_BACKEND_DOMAIN {
  reverse_proxy 127.0.0.1:3000
}
```

Caddy 会自动签发 HTTPS 证书。

### Nginx 示例

```nginx
server {
  listen 80;
  server_name YOUR_BACKEND_DOMAIN;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Nginx 的 HTTPS 可以用 Certbot 配置。

## 9. 验证后端

访问：

```txt
https://YOUR_BACKEND_DOMAIN/health
```

正常应该返回：

```json
{
  "status": "ok",
  "database": "ok",
  "environment": "production",
  "version": "0.1.0",
  "time": "..."
}
```

如果失败，先看后端日志：

```bash
docker logs -f starbuddy-api
```

常见原因：

- `.env` 里的 `DATABASE_URL` 密码错
- 数据库容器没启动
- 后端和数据库不在同一个 Docker network
- `DATABASE_URL` 仍然写成了 `127.0.0.1`
- Prisma migration 失败

也可以从后端容器里检查是否能解析数据库容器名：

```bash
docker exec -it starbuddy-api sh
```

进入容器后：

```sh
node -e "require('dns').lookup('starbuddy-postgres', console.log)"
```

## 10. 创建 GitHub OAuth App

打开 GitHub：

```txt
Settings -> Developer settings -> OAuth Apps -> New OAuth App
```

填写：

```txt
Application name: StarBuddy
Homepage URL: https://YOUR_FRONTEND_DOMAIN
Authorization callback URL: https://YOUR_BACKEND_DOMAIN/auth/github/callback
```

创建后拿到：

```env
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
```

回到服务器，编辑 `.env` 填入这两个值：

```bash
nano .env
```

重启后端：

```bash
docker rm -f starbuddy-api
docker run -d \
  --name starbuddy-api \
  --restart unless-stopped \
  --network starbuddy-net \
  --env-file .env \
  -p 127.0.0.1:3000:3000 \
  starbuddy-api
```

## 11. 部署前端到 Vercel

前端和后端分开部署。Vercel 只负责 `web/` 目录里的 Vite React 应用。

1. 打开 Vercel Dashboard。
2. Add New -> Project。
3. Import 你的 StarBuddy GitHub 仓库。
4. Framework Preset 选择 `Vite`。
5. Root Directory 设置为：

```txt
web
```

环境变量：

```env
VITE_API_BASE_URL=https://api.iroha.chat
```

构建配置：

```txt
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

部署完成后拿到：

```txt
https://iroha.chat
```

## 12. 回填最终域名

如果你一开始 `.env` 里用的是临时前端域名，现在改成 Vercel 最终域名：

```env
WEB_APP_URL=https://iroha.chat
CORS_ORIGINS=https://iroha.chat
GITHUB_OAUTH_CALLBACK_URL=https://api.iroha.chat/auth/github/callback
```

确认 GitHub OAuth App：

```txt
Homepage URL = https://iroha.chat
Authorization callback URL = https://api.iroha.chat/auth/github/callback
```

确认 Vercel：

```env
VITE_API_BASE_URL=https://api.iroha.chat
```

然后重启后端，重新部署前端。

## 13. 首次上线验收

### 13.1 后端健康检查

```txt
https://YOUR_BACKEND_DOMAIN/health
```

必须是 `status: ok`。

### 13.2 前端打开

```txt
https://YOUR_FRONTEND_DOMAIN
```

应该看到 StarBuddy 登录前引导页。

### 13.3 GitHub 登录

点击 GitHub 登录。

如果 GitHub 报：

```txt
The redirect_uri is not associated with this application.
```

检查这两个必须完全一致：

```env
GITHUB_OAUTH_CALLBACK_URL=https://api.iroha.chat/auth/github/callback
```

```txt
GitHub OAuth App Authorization callback URL=https://api.iroha.chat/auth/github/callback
```

### 13.4 管理员权限

登录用的 GitHub login 必须在：

```env
ADMIN_GITHUB_LOGINS=你的 GitHub login
```

登录后右侧应该能看到 Admin 面板。

### 13.5 提交仓库

进入“你的项目”，只能从 GitHub 公开仓库列表里点提交。

第一版不支持手动输入 URL。

### 13.6 执行任务

至少需要两个不同用户、两个不同仓库，才能互相推荐。

当前规则：

- 每个用户最多一个 active/paused 推广位
- 每天只能切换一次 active 仓库
- 每个用户每天最多完成 30 个 rewarded star
- 每个仓库每天最多接收 30 个 rewarded star

## 14. 常见问题

### 前端请求后端失败

检查 Vercel：

```env
VITE_API_BASE_URL=https://YOUR_BACKEND_DOMAIN
```

检查后端 `.env`：

```env
CORS_ORIGINS=https://YOUR_FRONTEND_DOMAIN
WEB_APP_URL=https://YOUR_FRONTEND_DOMAIN
```

然后重启后端、重新部署前端。

### 数据库迁移失败

看日志：

```bash
docker logs -f starbuddy-api
```

常见原因：

- `DATABASE_URL` 错
- 数据库容器没启动
- 数据库用户密码错
- 后端容器没有加入 `starbuddy-net`
- `DATABASE_URL` 使用了 `127.0.0.1` 或 `localhost`

验证数据库容器：

```bash
docker exec -it starbuddy-postgres psql -U starbuddy -d starbuddy -c "select now();"
```

验证后端和数据库在同一个网络：

```bash
docker network inspect starbuddy-net
```

输出里应该同时能看到 `starbuddy-postgres` 和 `starbuddy-api`。

### 想临时关闭任务系统

改 `.env`：

```env
STAR_TASKS_ENABLED=false
```

重启后端。

这样用户还能登录和查看数据，但不能领取/执行新任务。

### 想临时关闭推广提交

改 `.env`：

```env
REPOSITORY_PROMOTION_ENABLED=false
```

重启后端。

这样用户不能提交、激活、恢复推广仓库，但可以暂停现有 active 仓库。

## 15. 更新后端版本

以后代码更新后，在服务器上：

```bash
git pull
docker build -t starbuddy-api .
docker rm -f starbuddy-api
docker run -d \
  --name starbuddy-api \
  --restart unless-stopped \
  --network starbuddy-net \
  --env-file .env \
  -p 127.0.0.1:3000:3000 \
  starbuddy-api
```

数据库容器和 volume 不需要重建。后端启动时会自动执行 `npx prisma migrate deploy`。

## 16. 数据库备份

手动备份：

```bash
docker exec starbuddy-postgres pg_dump -U starbuddy -d starbuddy > starbuddy-backup.sql
```

恢复：

```bash
docker exec -i starbuddy-postgres psql -U starbuddy -d starbuddy < starbuddy-backup.sql
```

建议后续加定时备份，不要只依赖手动备份。

## 17. 上线前最后清单

- Docker 已安装
- `starbuddy-net` 已创建
- `starbuddy-postgres` 数据库容器已启动
- 数据库使用 `starbuddy-postgres-data` volume 持久化
- 后端 `.env` 已配置
- `DATABASE_URL` 指向 `starbuddy-postgres:5432`
- `starbuddy-api` 后端容器已启动
- 后端 `/health` 正常
- 后端域名 HTTPS 正常
- GitHub OAuth callback 完全匹配
- Vercel 前端 `VITE_API_BASE_URL` 指向后端
- 后端 `WEB_APP_URL` / `CORS_ORIGINS` 指向前端
- `ADMIN_GITHUB_LOGINS` 是你的 GitHub login
- `STAR_TASKS_ENABLED=true`
- `REPOSITORY_PROMOTION_ENABLED=true`
- 使用两个 GitHub 账号测试过登录、提交仓库、执行任务
