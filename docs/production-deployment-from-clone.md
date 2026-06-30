# StarBuddy 单机后端 + 自建 PostgreSQL 上线教程

这份教程按你的部署方式写：

- 后端：部署在你自己的 Linux 主机上，用 Docker 跑
- 数据库：同一台主机上的 PostgreSQL
- 前端：Vite React，部署到 Vercel
- OAuth：GitHub OAuth App

因为后端和数据库在同一台主机，PostgreSQL 不需要暴露公网，`DATABASE_URL` 使用 `127.0.0.1`。

## 0. 最终地址

你最终会有：

```txt
前端地址: https://YOUR_FRONTEND_DOMAIN
后端地址: https://YOUR_BACKEND_DOMAIN
GitHub OAuth Callback: https://YOUR_BACKEND_DOMAIN/auth/github/callback
```

后端健康检查：

```txt
https://YOUR_BACKEND_DOMAIN/health
```

## 1. 准备服务器

服务器需要：

- Ubuntu / Debian
- 一个公网 IP
- 已安装 Docker
- 已安装 PostgreSQL
- 后端公网域名已解析到这台服务器，比如 `api.example.com`

安装基础工具：

```bash
sudo apt update
sudo apt install -y git openssl postgresql postgresql-contrib
```

安装 Docker 可以参考 Docker 官方文档。安装完成后确认：

```bash
docker --version
```

启动 PostgreSQL：

```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo systemctl status postgresql
```

## 2. Clone 项目

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/StarBuddy.git
cd StarBuddy
```

如果这是你本地改完还没推到 GitHub 的代码，先在本地提交并推送，再在服务器上 clone 或 pull。

## 3. 创建 PostgreSQL 数据库

进入 PostgreSQL：

```bash
sudo -u postgres psql
```

创建用户和数据库：

```sql
create user starbuddy with password 'REPLACE_WITH_STRONG_PASSWORD';
create database starbuddy owner starbuddy;
grant all privileges on database starbuddy to starbuddy;
```

退出：

```sql
\q
```

验证数据库连接：

```bash
psql "postgresql://starbuddy:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/starbuddy"
```

进入后运行：

```sql
select now();
```

能返回时间就说明数据库正常。

## 4. 生成生产密钥

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

## 5. 创建后端 `.env`

在项目根目录创建 `.env`：

```bash
cp .env.example .env
nano .env
```

生产环境示例：

```env
NODE_ENV=production
DATABASE_URL="postgresql://starbuddy:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/starbuddy?connection_limit=10&pool_timeout=20"
JWT_SECRET="第 4 步生成的 JWT secret"
CREDENTIAL_ENCRYPTION_KEY="第 4 步生成的 32-byte base64 key"

GITHUB_OAUTH_CLIENT_ID="先留空，创建 GitHub OAuth App 后再填"
GITHUB_OAUTH_CLIENT_SECRET="先留空，创建 GitHub OAuth App 后再填"
GITHUB_OAUTH_CALLBACK_URL="https://YOUR_BACKEND_DOMAIN/auth/github/callback"

WEB_APP_URL="https://YOUR_FRONTEND_DOMAIN"
CORS_ORIGINS="https://YOUR_FRONTEND_DOMAIN"
ADMIN_GITHUB_LOGINS="你的 GitHub login"

STAR_TASKS_ENABLED=true
REPOSITORY_PROMOTION_ENABLED=true
GITHUB_REQUEST_TIMEOUT_MS=10000
CLEANUP_INTERVAL_MS=21600000

HOST="0.0.0.0"
PORT=3000
```

先不知道前端域名也没关系，Vercel 部署完成后回来改：

```env
WEB_APP_URL
CORS_ORIGINS
```

## 6. 构建并启动后端 Docker

在项目根目录构建镜像：

```bash
docker build -t starbuddy-api .
```

启动容器：

```bash
docker run -d \
  --name starbuddy-api \
  --restart unless-stopped \
  --env-file .env \
  --network host \
  starbuddy-api
```

这里使用 `--network host`，是为了让容器里的后端可以通过 `127.0.0.1:5432` 连接同一台主机上的 PostgreSQL。

查看日志：

```bash
docker logs -f starbuddy-api
```

当前 Dockerfile 启动时会执行：

```bash
npx prisma migrate deploy && node dist/main.js
```

也就是先跑数据库迁移，再启动后端。

## 7. 配置反向代理和 HTTPS

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

## 8. 验证后端

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

如果失败，先看容器日志：

```bash
docker logs -f starbuddy-api
```

常见原因：

- `.env` 里的 `DATABASE_URL` 密码错
- PostgreSQL 没启动
- Docker 没用 `--network host`
- Prisma migration 失败

## 9. 创建 GitHub OAuth App

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
  --env-file .env \
  --network host \
  starbuddy-api
```

## 10. 部署前端到 Vercel

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
VITE_API_BASE_URL=https://YOUR_BACKEND_DOMAIN
```

构建配置：

```txt
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

部署完成后拿到：

```txt
https://YOUR_FRONTEND_DOMAIN
```

## 11. 回填最终域名

如果你一开始 `.env` 里用的是临时前端域名，现在改成 Vercel 最终域名：

```env
WEB_APP_URL="https://YOUR_FRONTEND_DOMAIN"
CORS_ORIGINS="https://YOUR_FRONTEND_DOMAIN"
GITHUB_OAUTH_CALLBACK_URL="https://YOUR_BACKEND_DOMAIN/auth/github/callback"
```

确认 GitHub OAuth App：

```txt
Homepage URL = https://YOUR_FRONTEND_DOMAIN
Authorization callback URL = https://YOUR_BACKEND_DOMAIN/auth/github/callback
```

确认 Vercel：

```env
VITE_API_BASE_URL=https://YOUR_BACKEND_DOMAIN
```

然后重启后端，重新部署前端。

## 12. 首次上线验收

### 12.1 后端健康检查

```txt
https://YOUR_BACKEND_DOMAIN/health
```

必须是 `status: ok`。

### 12.2 前端打开

```txt
https://YOUR_FRONTEND_DOMAIN
```

应该看到 StarBuddy 登录前引导页。

### 12.3 GitHub 登录

点击 GitHub 登录。

如果 GitHub 报：

```txt
The redirect_uri is not associated with this application.
```

检查这两个必须完全一致：

```env
GITHUB_OAUTH_CALLBACK_URL=https://YOUR_BACKEND_DOMAIN/auth/github/callback
```

```txt
GitHub OAuth App Authorization callback URL=https://YOUR_BACKEND_DOMAIN/auth/github/callback
```

### 12.4 管理员权限

登录用的 GitHub login 必须在：

```env
ADMIN_GITHUB_LOGINS=你的 GitHub login
```

登录后右侧应该能看到 Admin 面板。

### 12.5 提交仓库

进入“你的项目”，只能从 GitHub 公开仓库列表里点提交。

第一版不支持手动输入 URL。

### 12.6 执行任务

至少需要两个不同用户、两个不同仓库，才能互相推荐。

当前规则：

- 每个用户最多一个 active/paused 推广位
- 每天只能切换一次 active 仓库
- 每个用户每天最多完成 30 个 rewarded star
- 每个仓库每天最多接收 30 个 rewarded star

## 13. 常见问题

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
- PostgreSQL 没启动
- 数据库用户密码错
- 数据库用户权限不足
- Docker 没有使用 `--network host`

可以在服务器本机验证：

```bash
psql "postgresql://starbuddy:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/starbuddy"
```

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

## 14. 更新后端版本

以后代码更新后，在服务器上：

```bash
git pull
docker build -t starbuddy-api .
docker rm -f starbuddy-api
docker run -d \
  --name starbuddy-api \
  --restart unless-stopped \
  --env-file .env \
  --network host \
  starbuddy-api
```

## 15. 数据库备份

手动备份：

```bash
pg_dump "postgresql://starbuddy:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/starbuddy" > starbuddy-backup.sql
```

恢复：

```bash
psql "postgresql://starbuddy:REPLACE_WITH_STRONG_PASSWORD@127.0.0.1:5432/starbuddy" < starbuddy-backup.sql
```

建议后续加定时备份，不要只依赖手动备份。

## 16. 上线前最后清单

- PostgreSQL 已启动
- `starbuddy` 数据库和用户已创建
- `.env` 已配置
- Docker 后端已启动
- 后端 `/health` 正常
- 后端域名 HTTPS 正常
- GitHub OAuth callback 完全匹配
- Vercel 前端 `VITE_API_BASE_URL` 指向后端
- 后端 `WEB_APP_URL` / `CORS_ORIGINS` 指向前端
- `ADMIN_GITHUB_LOGINS` 是你的 GitHub login
- `STAR_TASKS_ENABLED=true`
- `REPOSITORY_PROMOTION_ENABLED=true`
- 使用两个 GitHub 账号测试过登录、提交仓库、执行任务
