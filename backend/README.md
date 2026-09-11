# Backend (NestJS) — optional

Standalone REST API used by the Docker Compose / Path B deployment. The recommended production path is the Next.js B-lite app under `frontend/` (same `/api/v1` surface via Route Handlers).

## Setup

```bash
cp .env.example .env
yarn install --ignore-engines
yarn prisma migrate deploy
yarn prisma db seed
yarn start:dev
```

API docs: [`docs/API.md`](../docs/API.md). Deployment: [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

## Scripts

| Command | Purpose |
|---------|---------|
| `yarn start:dev` | Watch mode |
| `yarn build` | Compile |
| `yarn start:prod` | Run `dist/main.js` |
| `yarn test` | Unit tests (decision engine) |
| `yarn test:e2e` | Health e2e smoke |
