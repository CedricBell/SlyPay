# SpendLess — system architecture

## High-level diagram (textual)

```
┌─────────────┐      HTTPS / JSON       ┌──────────────────┐
│  Next.js    │ ◄──────────────────────► │  NestJS API      │
│  (web)      │   JWT access (Bearer)   │  REST /api/v1    │
└─────────────┘                         └────────┬─────────┘
                                                 │
                                        Prisma (SQL)
                                                 │
                                        ┌────────▼─────────┐
                                        │  PostgreSQL      │
                                        │  rules, offers,  │
                                        │  merchants, logs │
                                        └──────────────────┘
```

**Optional later workers** (not in MVP): offer-ingestion jobs, Plaid webhooks, notification fan-out. They would consume the same PostgreSQL schema and call the same pure decision engine package.

## Services

| Service | Responsibility |
|--------|------------------|
| **web** | Auth UX, wallet CRUD, merchant autocomplete, recommendation form, reasoning display |
| **api** | Auth (JWT + refresh), CRUD, category resolution, decision engine orchestration, recommendation logging |
| **db** | Source of truth for users, cards, rules, offers, merchants, MCC map, transactions, recommendation audit |

## Why REST (vs GraphQL)

- **Operational simplicity**: caching, CDN-friendly static assets, straightforward API gateway policies.
- **MVP velocity**: Nest pipes + `class-validator` give typed DTOs with minimal boilerplate.
- **Future-proofing**: GraphQL can be added behind a BFF if mobile clients need selective fields; the ranking engine stays transport-agnostic.

## Recommendation request data flow

1. Client sends `POST /api/v1/recommendation` with `{ amount, merchantName?, mcc?, categoryHint? }` and `Authorization: Bearer <access>`.
2. **Category resolver** applies, in order:
   - explicit `categoryHint` if present
   - merchant record match → `MerchantCategoryMapping` (confidence ordered)
   - inherited / explicit MCC → `MccCategoryMap`
   - fallback `OTHER` with trace strings for explainability
3. API loads active **credit cards** for the user with nested **rules** and **offers**.
4. **Decision engine** (pure TypeScript) normalizes earn types, applies monthly caps (when provided), resolves overlapping offers (`REPLACE_BASE` vs `ADDITIVE`), ranks cards, handles ties lexicographically by card id.
5. Response returns best card summary, ranked table, reasoning lines, and category trace.
6. If `persist !== false`, a **Recommendation** row is written for analytics/debugging.

## Scalability notes

- **Indexes**: see `prisma/schema.prisma` — user-scoped card lists, offer validity windows, merchant search (`normalized`), recommendation history by user/time.
- **Stateless API**: horizontal scale behind a load balancer; refresh tokens in DB allow revocation.
- **Hot paths**: recommendation is read-heavy on a small fan-out (cards per user); PostgreSQL handles MVP easily. Add read replicas if telemetry queries contend with OLTP.

## Security

- Passwords: **bcrypt** hashes only.
- Refresh tokens stored as **SHA-256** hashes (raw token returned once to the client).
- JWT access tokens are short-lived; CORS restricted via `CORS_ORIGIN`.
