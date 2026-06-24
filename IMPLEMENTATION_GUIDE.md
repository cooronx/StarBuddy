# StarBuddy 第一版实施指南

## 目标

StarBuddy 第一版只实现“互相点 GitHub star”的闭环：

- 用户使用 GitHub OAuth 登录。
- 用户提交自己的公开 GitHub 仓库作为被 star 目标。
- 用户主动领取或执行其他人的 star 任务。
- 系统在用户触发任务时，代表该用户调用 GitHub API 给目标仓库点 star。
- 系统验证 star 成功后发放和扣减积分。
- 用户用积分换取自己的仓库进入任务池。

第一版不做 watch、fork、私有仓库、支付、复杂排行榜、复杂反作弊、后台静默自动 star 和 Redis 队列。

## 技术栈

- 后端：NestJS + TypeScript
- 数据库：PostgreSQL
- ORM：Prisma
- 前端：Vite + React
- 外部服务：GitHub REST API

Redis 暂不引入。任务领取、冷却、限流、一次性登录 code 和积分流水都先用 PostgreSQL 完成。

## 本地开发环境

```env
DATABASE_URL="postgresql://starbuddy:starbuddy123@localhost:5432/starbuddy"
JWT_SECRET="replace-with-a-local-development-secret"
CREDENTIAL_ENCRYPTION_KEY="base64-encoded-32-byte-key"
GITHUB_OAUTH_CLIENT_ID="github-oauth-client-id"
GITHUB_OAUTH_CLIENT_SECRET="github-oauth-client-secret"
GITHUB_OAUTH_CALLBACK_URL="http://127.0.0.1:3000/auth/github/callback"
WEB_APP_URL="http://127.0.0.1:5173"
HOST="0.0.0.0"
PORT=3000
```

`CREDENTIAL_ENCRYPTION_KEY` 必须是 32 字节随机值的 base64 编码：

```bash
openssl rand -base64 32
```

生产环境必须使用独立数据库账号、强随机密钥和服务端环境变量配置，不能把生产密钥提交到 Git。

## 已确认的第一版决策

- 第一版使用 GitHub OAuth App 登录，不再支持手填 PAT。
- OAuth 一次授权，请求 `read:user public_repo`。
- callback 后强制校验 GitHub 返回的 scopes 同时包含 `read:user` 和 `public_repo`，否则登录失败。
- 本地账号唯一标识是 `github_user_id`。
- GitHub OAuth access token 必须使用 AES-256-GCM 加密保存到 `github_authorizations`。
- GitHub OAuth access token 只存在后端，不能返回给前端。
- Web 登录态使用 StarBuddy 自己签发的 JWT，第一版有效期 7 天。
- 前端继续把 StarBuddy JWT 保存到 `localStorage`。
- OAuth callback 不直接把 JWT 放进 URL，而是生成 60 秒有效、一次性消费的 login code。
- 用户主动触发任务时才代表用户 star，不做离线或后台静默自动 star。
- 积分使用 `credits_ledger` 流水账，同时在 `users.credits_balance` 缓存余额。
- 新用户初始 5 credits。
- 完成一次有效 star，执行者 +1 credit，目标仓库 owner -1 credit。
- owner 余额不足时，其任务不再分发。
- 仓库提交和任务可分发状态分开，余额不足不影响仓库保存。
- 同一用户对同一仓库终身最多结算一次。
- 用户已提前 star 的仓库不发奖励、不扣 owner 积分，但记录排除。

## GitHub 授权策略

第一版使用 GitHub OAuth App：

- `GET /auth/github` 由后端生成 `state`，写入 httpOnly `sameSite=lax` cookie，并跳转 GitHub authorize URL。
- GitHub OAuth scopes 固定为 `read:user public_repo`。
- `GET /auth/github/callback` 校验 state，用 code 换 GitHub access token。
- 后端调用 GitHub `GET /user` 获取 GitHub 用户身份。
- 后端读取 `X-OAuth-Scopes`，缺少任一 required scope 就拒绝登录。
- 以 `github_user_id` 查找或创建本地用户。
- 加密保存 GitHub OAuth access token 和实际 scopes。
- 生成一次性 login code，跳回前端 `/auth/callback?code=...`。
- 前端调用 `POST /auth/session` 用 login code 换 StarBuddy JWT。

OAuth 失败时只向前端返回内部定义的错误码：

- `access_denied`
- `insufficient_scope`
- `github_oauth_failed`
- `state_mismatch`

## 核心流程

### 1. GitHub OAuth 登录

1. 前端跳转后端 `GET /auth/github`。
2. 后端生成 state cookie 并跳转 GitHub。
3. GitHub callback 回后端。
4. 后端校验 state，换取 access token。
5. 后端调用 `GET /user`，校验 `read:user public_repo` scopes。
6. 后端 upsert `users` 和 `github_authorizations`。
7. 后端创建一次性 `oauth_login_codes` 记录，只保存 code hash。
8. 后端跳回前端 `/auth/callback?code=...`。
9. 前端调用 `POST /auth/session` 换 StarBuddy JWT。

### 2. 提交仓库

1. 用户提交仓库地址，例如 `https://github.com/owner/repo`。
2. 后端解析出 `owner` 和 `repo`。
3. 后端使用该用户 active GitHub authorization 调 GitHub API 检查仓库存在且为公开仓库。
4. 保存仓库记录。
5. 创建或更新该仓库的 star task。

### 3. 领取 star 任务

1. 用户请求领取任务。
2. 后端排除用户自己的仓库。
3. 后端排除用户已完成、已领取未过期、已被风控拦截的任务。
4. 后端用事务创建领取记录。
5. 返回任务目标仓库。

领取任务时可以使用 PostgreSQL 行锁：

```sql
FOR UPDATE SKIP LOCKED
```

### 4. 执行 star

1. 用户主动点击 star/执行任务。
2. 后端读取用户 active GitHub authorization 并解密 access token。
3. 调用 GitHub API：

```http
PUT /user/starred/{owner}/{repo}
```

4. GitHub 返回 `204` 视为 star 请求成功。
5. 后端再调用检查接口验证结果：

```http
GET /user/starred/{owner}/{repo}
```

6. 验证成功后写入 `star_actions`。
7. 写入积分流水。
8. 标记领取记录完成。

## 模块划分

```txt
src/
  app.module.ts
  config/
  database/
  auth/
  credential-crypto/
  github/
  repositories/
  star-tasks/
  credits/
```

### AuthModule

- 发起 GitHub OAuth 登录。
- 处理 GitHub OAuth callback。
- 用一次性 login code 创建 StarBuddy session。
- 当前用户查询。
- 撤销 GitHub authorization。

### CredentialCryptoModule

- 加密和解密服务端保存的外部凭证。
- 当前用于 GitHub OAuth access token。

### GithubModule

- OAuth code 换 access token。
- 调用 `GET /user` 并读取 OAuth scopes。
- 查询仓库。
- star 仓库。
- 检查是否已 star。
- 统一处理 GitHub rate limit 和错误码。

## 数据表草案

### users

- `id`
- `github_user_id`
- `github_login`
- `avatar_url`
- `credits_balance`
- `created_at`
- `updated_at`

约束：

- `github_user_id` 唯一。

### github_authorizations

- `id`
- `user_id`
- `encrypted_access_token`
- `access_token_iv`
- `access_token_auth_tag`
- `scopes`
- `status`
- `last_verified_at`
- `created_at`
- `updated_at`

说明：

- access token 字段必须加密保存。
- `status` 可为 `active`、`invalid`、`revoked`。
- `revoked` 状态必须清空加密 token、IV 和 auth tag。

### oauth_login_codes

- `id`
- `code_hash`
- `user_id`
- `expires_at`
- `consumed_at`
- `created_at`

说明：

- 只保存 login code 的 hash。
- login code 60 秒过期。
- login code 只能消费一次。

### repositories

- `id`
- `owner_user_id`
- `github_owner`
- `github_repo`
- `github_repo_id`
- `description`
- `stars_count_snapshot`
- `status`
- `created_at`
- `updated_at`

约束：

- `github_owner + github_repo` 唯一。

## 当前实现入口

- `GET /auth/github`：发起 GitHub OAuth。
- `GET /auth/github/callback`：处理 GitHub OAuth callback。
- `POST /auth/session`：用一次性 login code 换 StarBuddy JWT。
- `GET /auth/me`：查询当前用户。
- `DELETE /auth/github-authorization`：撤销当前用户保存的 GitHub authorization。
- `POST /repositories`：提交公开 GitHub 仓库并创建 star task。
- `GET /repositories/mine`：查询自己提交的仓库。
- `GET /repositories/github/mine`：查询当前 GitHub 用户的公开仓库。
- `POST /star-tasks/execute-next`：自动领取并执行一个可用 star 任务。
- `GET /star-tasks/current`：领取或返回当前推荐项目 claim，不执行 star。
- `POST /star-tasks/:claimId/star`：对指定 claim 执行 GitHub star 并结算。
- `POST /star-tasks/:claimId/skip`：跳过指定 claim。
- `GET /credits/balance`：查询当前积分余额。
- `GET /credits/ledger`：查询积分流水。

## 前端第一版

前端位于 `web/`，使用 Vite + React：

- 未登录时显示 `Continue with GitHub`。
- 点击后跳转后端 `GET /auth/github`。
- `/auth/callback?code=...` 会调用 `POST /auth/session` 换 StarBuddy JWT。
- `/auth/callback?error=...` 会展示对应错误。
- 登录后显示 GitHub 用户和 credits。
- 主卡片展示当前推荐项目。
- 点击 `Star this project` 后调用 `POST /star-tasks/:claimId/star`。
- 点击 `Skip` 后调用 `POST /star-tasks/:claimId/skip` 并加载下一个项目。
- 左侧可提交自己的仓库。
- 右侧显示积分余额和最近流水。

启动方式：

```bash
# 后端
npm run start:dev

# 前端
cd web
npm run dev -- --host 0.0.0.0
```

## 基础风控规则

第一版至少实现：

- 用户不能 star 自己提交的仓库。
- 用户对同一仓库只能结算一次。
- 用户每天完成任务数量有限制。
- 同一 IP 每小时领取任务数量有限制。
- GitHub authorization 失效用户不能领取或执行任务。
- GitHub API 返回 `403`、`422` 或 rate limit 时记录风险事件。
- 任务领取有过期时间，过期后允许其他用户领取。

## 安全要求

- GitHub OAuth access token 不能写入日志。
- GitHub OAuth access token 不能返回给前端。
- GitHub OAuth access token 必须使用服务端密钥加密后入库。
- 服务端密钥不能提交到 Git。
- OAuth state 必须校验。
- login code 必须短期有效、一次性消费、只存 hash。
- 所有 GitHub API 错误要做脱敏记录。
- 撤销 GitHub authorization 时要立即清空加密 token。
- 对敏感接口做登录校验和基础频率限制。

## 后续产品规则

项目提交数量不能无限增长。后续必须引入 active repository quota：

- 每个用户最多 N 个 active submitted repositories。
- repository lifecycle: `active` / `archived` / `expired`。
- 任务分发只读取 active repositories。
