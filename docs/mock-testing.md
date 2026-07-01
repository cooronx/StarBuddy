# Local Mock Testing

Mock testing lets one developer test multi-user StarBuddy flows without real GitHub OAuth or real GitHub stars.

## Enable Mock Mode

In local `.env`:

```env
MOCK_GITHUB=true
ADMIN_GITHUB_LOGINS="mock-admin"
```

Mock mode is blocked in production. If `NODE_ENV=production` and `MOCK_GITHUB=true`, the backend fails to start.

## Prepare Database

Apply the current Prisma migrations before seeding:

```bash
npx prisma migrate dev
```

## Seed Demo Data

Make sure local PostgreSQL is running, then:

```bash
npm run seed:demo
```

The seed script only resets these fixed mock users:

```txt
mock-alice
mock-bob
mock-charlie
mock-diana
mock-admin
```

It refuses to run when:

- `NODE_ENV=production`
- `DATABASE_URL` is not `localhost` or `127.0.0.1`

The seed recreates the mock users, their repositories, historical star actions, and matching credit ledger entries in one pass.

## Start The App

Backend:

```bash
npm run start:dev
```

Frontend:

```bash
cd web
npm run dev
```

Open the frontend. The login page shows mock login buttons for the demo users.

## Demo Users

Each user starts from the same demo baseline, then seeded history adjusts balances to match prior rewarded stars. Every mock user has submitted and unsubmitted mock repositories available for testing.

```txt
mock-alice
mock-bob
mock-charlie
mock-diana
mock-admin
```

`mock-admin` is an admin when `ADMIN_GITHUB_LOGINS="mock-admin"`.

## Suggested Manual Test Flow

1. Login as `mock-alice`.
2. Check "Your projects"; submitted and unsubmitted repositories should both appear.
3. Submit an unsubmitted repository.
4. Logout and login as `mock-bob`.
5. Load a recommended task and star it.
6. Verify `mock-bob` gains 1 credit and the repository owner spends 1 credit.
7. Report a recommended repository.
8. Logout and login as `mock-admin`.
9. Open the Admin panel and archive/reject/restore a reported repository.
10. Verify rejected/archived repositories no longer enter the task pool.

## Seeded Special States

The demo data includes:

- active repositories
- inactive repositories
- one paused repository
- one rejected repository
- one user with today's promotion switch already used
- a few historical rewarded stars
- matching owner spend and actor reward ledger entries for rewarded stars
- one already-starred/no-reward action
- two open reports for the admin panel

The seed does not fill daily limits by default, so normal task flow remains usable.
