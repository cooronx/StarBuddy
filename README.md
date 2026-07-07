# StarBuddy

StarBuddy is a local-first prototype for exchanging GitHub stars. The backend is NestJS + PostgreSQL + Prisma, and the frontend is a Vite React app in `web/`.

## Prerequisites

- Node.js
- npm
- Docker
- OpenSSL

## 1. Start PostgreSQL

```bash
docker run --name starbuddy-postgres \
  -e POSTGRES_USER=starbuddy \
  -e POSTGRES_PASSWORD=starbuddy123 \
  -e POSTGRES_DB=starbuddy \
  -p 5432:5432 \
  -d postgres:16
```

If the container already exists, start it instead:

```bash
docker start starbuddy-postgres
```

## 2. Install Backend Dependencies

```bash
npm install
```

## 3. Configure Backend Environment

```bash
cp .env.example .env
```

Generate a local credential encryption key:

```bash
openssl rand -base64 32
```

Edit `.env`:

```env
DATABASE_URL="postgresql://starbuddy:starbuddy123@localhost:5432/starbuddy"
JWT_SECRET="starbuddy-local-development-secret"
CREDENTIAL_ENCRYPTION_KEY="paste-the-generated-base64-key-here"
GITHUB_OAUTH_CLIENT_ID="your-github-oauth-client-id"
GITHUB_OAUTH_CLIENT_SECRET="your-github-oauth-client-secret"
GITHUB_OAUTH_CALLBACK_URL="http://127.0.0.1:3000/auth/github/callback"
WEB_APP_URL="http://127.0.0.1:5173"
CORS_ORIGINS="http://127.0.0.1:5173"
ADMIN_GITHUB_LOGINS="your-github-login"
STAR_TASKS_ENABLED=true
REPOSITORY_PROMOTION_ENABLED=true
GITHUB_REQUEST_TIMEOUT_MS=10000
CLEANUP_INTERVAL_MS=21600000
HOST="0.0.0.0"
PORT=3000
```

## 4. Initialize Database

```bash
npx prisma migrate dev
```

## 5. Start Backend

```bash
npm run start:dev
```

Backend API:

```txt
http://127.0.0.1:3000
```

Health check:

```txt
http://127.0.0.1:3000/health
```

## 6. Install Frontend Dependencies

Open another terminal:

```bash
cd web
npm install
cp .env.example .env
```

For local access, `web/.env` can stay as:

```env
VITE_API_BASE_URL=http://127.0.0.1:3000
```

If accessing from another machine, use the backend machine IP:

```env
VITE_API_BASE_URL=http://YOUR_SERVER_IP:3000
```

## 7. Start Frontend

```bash
npm run dev -- --host 0.0.0.0
```

Frontend:

```txt
http://127.0.0.1:5173
```

If accessing from another machine:

```txt
http://YOUR_SERVER_IP:5173
```

## GitHub OAuth App

Create a GitHub OAuth App for local development.

Callback URL:

```txt
http://127.0.0.1:3000/auth/github/callback
```

Requested scopes:

```txt
read:user public_repo
```

The backend stores the GitHub OAuth access token encrypted. The frontend only stores the StarBuddy JWT.

## Production Notes

For a complete clone-to-production guide, see:

[docs/production-deployment-from-clone.md](docs/production-deployment-from-clone.md)

Run migrations with Prisma before starting or during container startup:

```bash
npx prisma migrate deploy
```

Set the production GitHub OAuth callback URL to the backend URL exactly:

```txt
https://api.iroha.chat/auth/github/callback
```

Set the frontend API base URL:

```env
VITE_API_BASE_URL=https://api.iroha.chat
```

Useful production backend variables:

```env
WEB_APP_URL="https://iroha.chat"
CORS_ORIGINS="https://iroha.chat"
ADMIN_GITHUB_LOGINS="your-github-login"
STAR_TASKS_ENABLED=true
REPOSITORY_PROMOTION_ENABLED=true
HOST="0.0.0.0"
PORT=3000
```

To stop new task execution immediately without taking the site down:

```env
STAR_TASKS_ENABLED=false
```

To stop new promotion submissions and activation/resume actions:

```env
REPOSITORY_PROMOTION_ENABLED=false
```

## Useful Commands

Backend:

```bash
npm run typecheck
npm run build
npm run lint
npm run seed:demo
```

Frontend:

```bash
cd web
npm run typecheck
npm run build
```

## Local Mock Testing

For local multi-user testing without real GitHub accounts, set:

```env
MOCK_GITHUB=true
ADMIN_GITHUB_LOGINS="mock-admin"
```

Before seeding demo users, make sure your local schema is current:

```bash
npx prisma migrate dev
```

Then reset demo data:

```bash
npm run seed:demo
```

`seed:demo` only runs against a local database (`localhost` or `127.0.0.1`) and refuses to run in `NODE_ENV=production`.

Start backend and frontend normally. The login page will show mock users:

```txt
mock-alice
mock-bob
mock-charlie
mock-diana
mock-admin
```

The seeded dataset includes:

- mock users with starting balances and matching ledger history
- submitted and unsubmitted repositories per user
- one paused promotion slot
- one rejected repository
- rewarded and no-reward star history
- open moderation reports for the admin flow

Mock mode only works outside `NODE_ENV=production`.
