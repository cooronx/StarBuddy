# StarBuddy 第一版实施指南

## 目标

StarBuddy 第一版只实现“互相点 GitHub star”的闭环：

- 用户用 GitHub 身份登录/绑定账号。
- 用户提交自己的公开 GitHub 仓库作为被 star 目标。
- 用户领取其他人的 star 任务。
- 系统代表用户调用 GitHub API 给目标仓库点 star。
- 系统验证 star 成功后发放积分。
- 用户用积分换取自己的仓库进入任务池。

第一版不做 watch、fork、私有仓库、支付、复杂排行榜、复杂反作弊和 Redis 队列。

## 技术栈

- 后端：NestJS + TypeScript
- 数据库：PostgreSQL
- ORM：Prisma
- 部署：先 Docker Compose，本地和单机都可运行
- 外部服务：GitHub REST API

Redis 暂不引入。任务领取、冷却、限流、积分流水都先用 PostgreSQL 完成。

## 本地开发环境

当前本地 Docker PostgreSQL 连接字符串：

```env
DATABASE_URL="postgresql://starbuddy:starbuddy123@localhost:5432/starbuddy"
JWT_SECRET="replace-with-a-local-development-secret"
TOKEN_ENCRYPTION_KEY="base64-encoded-32-byte-key"
HOST="0.0.0.0"
PORT=3000
```

该连接字符串只用于本地开发。生产环境必须使用独立账号、强密码和服务端环境变量配置，不能把生产数据库密码提交到 Git。

`TOKEN_ENCRYPTION_KEY` 必须是 32 字节随机值的 base64 编码，可用下面的命令生成：

```bash
openssl rand -base64 32
```

## 已确认的第一版决策

- 第一版不做 OAuth 登录，只做 fine-grained PAT 入口。
- 用户提交 PAT 后，后端调用 GitHub `GET /user` 识别身份。
- 本地账号唯一标识是 `github_user_id`，不是 PAT。
- PAT 必须使用 AES-256-GCM 加密保存。
- Web 登录态使用 StarBuddy 自己签发的 JWT。
- JWT 有效期第一版设为 7 天。
- 积分使用 `credits_ledger` 流水账，同时在 `users.credits_balance` 缓存余额。
- 新用户初始 5 credits。
- 完成一次有效 star，执行者 +1 credit，目标仓库 owner -1 credit。
- owner 余额不足时，其任务不再分发。
- 仓库提交和任务可分发状态分开，余额不足不影响仓库保存。
- 同一用户对同一仓库终身最多结算一次。
- 用户已提前 star 的仓库不发奖励、不扣 owner 积分，但记录排除。
- 第一版使用 `POST /star-tasks/execute-next`，后端自动领取并执行下一个任务。

## 产品边界

### 第一版包含

- GitHub 用户身份识别
- GitHub token 绑定
- 仓库提交
- star 任务池
- 领取任务
- 自动 star
- star 结果验证
- 积分发放和消费
- 基础风控

### 第一版不包含

- 自动 watch
- 自动 fork
- 用户之间私信
- 支付购买积分
- 多平台账号
- 管理后台
- Redis 队列
- 复杂推荐算法

## GitHub 授权策略

第一版为了降低实现成本，使用用户手动提交 fine-grained PAT 作为入口。后续可迁移到 GitHub App 或 OAuth。

必须遵守以下约束：

- 只支持 fine-grained personal access token。
- 只要求 `Starring: write` 和 `Metadata: read`。
- 不要求 classic token 的 `repo` 或 `user` scope。
- 不把 token 当账号唯一 id。
- 提交 token 后必须调用 GitHub API 验证 token 对应的 GitHub 用户身份。
- 数据库保存 `github_user_id` 作为账号标识。
- token 必须加密存储，不能明文保存。
- 用户可以随时删除或替换 token。
- token 失效时只标记授权失效，不删除用户账号。

第一版禁止要求用户提供 `repo` + `user` classic PAT。这个权限过大，会让产品承担不必要的安全责任。

## 核心流程

### 1. 绑定 GitHub 身份

1. 用户提交 GitHub token。
2. 后端调用 `GET /user` 获取 GitHub 用户信息。
3. 以 `github_user_id` 查找或创建本地用户。
4. 加密保存 token。
5. 记录 token 权限检查结果和授权状态。

### 2. 提交仓库

1. 用户提交仓库地址，例如 `https://github.com/owner/repo`。
2. 后端解析出 `owner` 和 `repo`。
3. 后端调用 GitHub API 检查仓库存在且为公开仓库。
4. 保存仓库记录。
5. 创建或更新该仓库的 star 任务配置。

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

1. 后端读取用户加密 token 并解密。
2. 调用 GitHub API：

```http
PUT /user/starred/{owner}/{repo}
```

3. GitHub 返回 `204` 视为 star 请求成功。
4. 后端再调用检查接口验证结果：

```http
GET /user/starred/{owner}/{repo}
```

5. 验证成功后写入 `star_actions`。
6. 写入积分流水。
7. 标记领取记录完成。

## 建议模块划分

```txt
src/
  app.module.ts
  config/
  database/
  auth/
  users/
  github/
  repositories/
  star-tasks/
  credits/
  risk/
```

### AuthModule

- 处理登录态
- 绑定 GitHub token
- 删除或替换 token
- 当前用户查询

### GithubModule

- 封装 GitHub API 调用
- 验证 token
- 查询仓库
- star 仓库
- 检查是否已 star
- 统一处理 GitHub rate limit 和错误码

### UsersModule

- 本地用户资料
- GitHub 用户映射
- 授权状态

### RepositoriesModule

- 仓库提交
- 仓库校验
- 仓库上下架

### StarTasksModule

- 任务池
- 任务领取
- 执行 star
- 完成验证

### CreditsModule

- 积分流水
- 积分余额查询
- 消费和发放

### RiskModule

- 基础限流
- 冷却时间
- 异常记录

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

### github_tokens

- `id`
- `user_id`
- `encrypted_token`
- `token_iv`
- `token_auth_tag`
- `token_type`
- `permissions_snapshot`
- `status`
- `last_verified_at`
- `created_at`
- `updated_at`

说明：

- `encrypted_token` 必须加密。
- `status` 可为 `active`、`invalid`、`revoked`。

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

### star_tasks

- `id`
- `repository_id`
- `status`
- `reward_credits`
- `daily_limit`
- `created_at`
- `updated_at`

### task_claims

- `id`
- `task_id`
- `user_id`
- `status`
- `claimed_at`
- `expires_at`
- `completed_at`

约束：

- 同一用户不能同时领取同一任务的未完成 claim。

### star_actions

- `id`
- `task_id`
- `repository_id`
- `actor_user_id`
- `github_owner`
- `github_repo`
- `status`
- `github_verified_at`
- `created_at`

约束：

- `actor_user_id + repository_id` 唯一，防止重复结算。

### credits_ledger

- `id`
- `user_id`
- `amount`
- `reason`
- `related_entity_type`
- `related_entity_id`
- `created_at`

说明：

- 积分余额通过流水汇总得到。
- 不要只在用户表上维护一个可随意修改的余额字段。

### rate_limit_events

- `id`
- `user_id`
- `ip_address`
- `event_type`
- `created_at`

用于第一版简单统计频率，后续需要时再迁移到 Redis。

## API 草案

### Auth

- `POST /auth/github-token`
- `DELETE /auth/github-token`
- `GET /auth/me`

### Repositories

- `POST /repositories`
- `GET /repositories/mine`
- `PATCH /repositories/:id/status`

### Star Tasks

- `POST /star-tasks/claim`
- `POST /star-tasks/:claimId/complete`
- `GET /star-tasks/mine`

### Credits

- `GET /credits/balance`
- `GET /credits/ledger`

## 当前实现入口

第一版后端接口：

- `POST /auth/github-token`：提交 GitHub fine-grained PAT，创建/登录本地账号，返回 StarBuddy JWT。
- `GET /auth/me`：查询当前用户。
- `DELETE /auth/github-token`：删除当前用户保存的 GitHub token。
- `POST /repositories`：提交公开 GitHub 仓库并创建 star task。
- `GET /repositories/mine`：查询自己提交的仓库。
- `POST /star-tasks/execute-next`：自动领取并执行一个可用 star 任务。
- `GET /star-tasks/current`：领取或返回当前推荐项目 claim，不执行 star。
- `POST /star-tasks/:claimId/star`：对指定 claim 执行 GitHub star 并结算。
- `POST /star-tasks/:claimId/skip`：跳过指定 claim。
- `GET /credits/balance`：查询当前积分余额。
- `GET /credits/ledger`：查询积分流水。

## 前端第一版

前端位于 `web/`，使用 Vite + React。页面是卡片式推荐流：

- 未登录时输入 GitHub fine-grained PAT。
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
- token 失效用户不能领取任务。
- GitHub API 返回 `403`、`422` 或 rate limit 时记录风险事件。
- 任务领取有过期时间，过期后允许其他用户领取。

## 安全要求

- token 不能写入日志。
- token 不能返回给前端。
- token 必须使用服务端密钥加密后入库。
- 服务端密钥不能提交到 Git。
- 所有 GitHub API 错误要做脱敏记录。
- 删除用户 token 时要立即清空加密 token。
- 对敏感接口做登录校验和基础频率限制。

## 实施顺序

### Milestone 1：项目骨架

- 初始化 NestJS 项目。
- 配置 Prisma。
- 配置 PostgreSQL。
- 添加 Docker Compose。
- 添加环境变量校验。

### Milestone 2：GitHub 身份绑定

- 实现 token 提交。
- 调用 GitHub `GET /user`。
- 创建本地用户。
- 加密保存 token。
- 实现当前用户查询。

### Milestone 3：仓库提交

- 解析 GitHub 仓库 URL。
- 调用 GitHub API 校验公开仓库。
- 保存仓库。
- 创建 star task。

### Milestone 4：任务领取

- 实现任务筛选。
- 实现领取记录。
- 实现过期逻辑。
- 防止重复领取和领取自己的任务。

### Milestone 5：执行和验证 star

- 调用 GitHub star API。
- 验证是否已 star。
- 写入 `star_actions`。
- 写入积分流水。
- 完成 claim。

### Milestone 6：基础风控和测试

- 添加每日限制。
- 添加 IP 频率限制。
- 添加 token 失效处理。
- 补核心业务测试。

## 后续再考虑

- GitHub App 替代手动 token。
- Redis 限流和任务队列。
- 管理后台。
- 支付积分。
- 排行榜。
- 更复杂的作弊检测。
- watch 和 fork，但不建议早期做。
