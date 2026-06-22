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

Generate a local token encryption key:

```bash
openssl rand -base64 32
```

Edit `.env`:

```env
DATABASE_URL="postgresql://starbuddy:starbuddy123@localhost:5432/starbuddy"
JWT_SECRET="starbuddy-local-development-secret"
TOKEN_ENCRYPTION_KEY="paste-the-generated-base64-key-here"
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

## GitHub Token Permissions

Use a GitHub fine-grained personal access token.

Required permission:

```txt
Account permissions:
  Starring: Read and write
```

Keep all unrelated permissions disabled. Metadata access for public repositories is included by GitHub for fine-grained tokens.

## Useful Commands

Backend:

```bash
npm run typecheck
npm run build
npm run lint
```

Frontend:

```bash
cd web
npm run typecheck
npm run build
```
