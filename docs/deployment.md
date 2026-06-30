# Deployment Checklist

For the full clone-to-production walkthrough, see:

[production-deployment-from-clone.md](production-deployment-from-clone.md)

## Backend

- Build command: `docker build -t starbuddy-api .`
- Start command: `docker run -d --name starbuddy-api --restart unless-stopped --env-file .env --network host starbuddy-api`
- Health check path: `/health`
- Required env:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `CREDENTIAL_ENCRYPTION_KEY`
  - `GITHUB_OAUTH_CLIENT_ID`
  - `GITHUB_OAUTH_CLIENT_SECRET`
  - `GITHUB_OAUTH_CALLBACK_URL`
  - `WEB_APP_URL`
  - `CORS_ORIGINS`
  - `ADMIN_GITHUB_LOGINS`
  - `HOST=0.0.0.0`
  - `PORT=3000`

## Kill Switches

- `STAR_TASKS_ENABLED=false` stops task claiming and star execution.
- `REPOSITORY_PROMOTION_ENABLED=false` stops repository submission, activation, and resume.
- Pause still works while promotion is disabled.

## Frontend

- Build command: `cd web && npm ci && npm run build`
- Output directory: `web/dist`
- Required env:
  - `VITE_API_BASE_URL=https://YOUR_BACKEND_DOMAIN`

## GitHub OAuth

The callback URL in the GitHub OAuth App must exactly match:

```txt
https://YOUR_BACKEND_DOMAIN/auth/github/callback
```

The app needs `read:user` and `public_repo`.
