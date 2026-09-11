# Frontend (Next.js)

SlyPay / SpendLess web app: App Router UI, Supabase Auth, Prisma, and B-lite `/api/v1` Route Handlers.

## Setup

```bash
cp .env.example .env.local
npm install
npx prisma migrate deploy
npm run dev
```

See root [`README.md`](../README.md) and [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npx prisma migrate deploy` | Apply migrations |
| `npx prisma generate` | Regenerate Prisma client |
