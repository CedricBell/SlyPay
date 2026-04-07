# SpendLess REST API (`/api/v1`)

Global prefix: **`/api/v1`**. JSON bodies. Validation errors return Nest’s default `{ "statusCode": 400, "message": [...] }` shape.

## Auth

### `POST /auth/register`

```json
{ "email": "you@company.com", "password": "long-password" }
```

**200**

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

### `POST /auth/login`

Same body as register.

### `POST /auth/refresh`

```json
{ "refreshToken": "..." }
```

Returns fresh access + refresh (rotation).

### `POST /auth/logout`

```json
{ "refreshToken": "..." }
```

### `GET /auth/me`

Header: `Authorization: Bearer <access>`

Returns `{ id, email, role, isActive, createdAt }` (`role` is `USER` or `ADMIN`).

---

## Admin (JWT + `role: ADMIN`)

### `GET /admin/users?page=1&limit=50`

Paginated list: `items[]` with `id`, `email`, `role`, `isActive`, `createdAt`, `cardCount`, plus `total`, `page`, `pages`, `limit`.

### `PATCH /admin/users/:id`

```json
{ "isActive": false }
```

```json
{ "role": "ADMIN" }
```

```json
{ "role": "USER" }
```

You cannot disable yourself or change your own role via this endpoint. Disabling a user revokes all refresh tokens for that account.

---

## Cards (JWT)

### `GET /cards`

### `GET /cards/catalog/suggestions?q=sapphire&limit=12`

Autocomplete for the add-card flow. Returns an array of `{ id, name, issuer, colorHex?, rules[] }` (illustrative earn templates — not issuer-official).

**Note:** This route is registered **before** `GET /cards/:id` so `catalog` is not parsed as an id.

### `GET /cards/:id`

### `POST /cards`

```json
{
  "name": "Sapphire Reserve",
  "issuer": "Chase",
  "last4": "4242",
  "colorHex": "#0f172a",
  "rules": [
    {
      "category": "DINING",
      "multiplier": 3,
      "earningType": "POINTS",
      "capAmountMonthly": 150,
      "priority": 0,
      "notes": "3x on dining"
    }
  ]
}
```

### `PATCH /cards/:id`

Same fields (all optional). When `rules` is sent, it **replaces** all rules.

### `DELETE /cards/:id`

---

## Offers (JWT)

### `GET /offers?cardId=<optional>`

### `POST /offers`

```json
{
  "creditCardId": "clx...",
  "title": "Q2 groceries",
  "category": "GROCERIES",
  "multiplier": 5,
  "stackPolicy": "REPLACE_BASE",
  "validFrom": "2025-06-01T00:00:00.000Z",
  "validUntil": "2025-06-30T23:59:59.000Z"
}
```

### `DELETE /offers/:id`

---

## Merchants

### `GET /merchants?q=whole` (public)

Returns merchants with category mappings for autocomplete.

### `POST /merchants` (JWT)

```json
{
  "displayName": "Whole Foods Market",
  "mcc": "5411",
  "categories": [{ "category": "GROCERIES" }]
}
```

---

## Recommendation (JWT)

### `POST /recommendation`

```json
{
  "amount": 87.12,
  "merchantName": "Whole Foods Market",
  "mcc": "5411",
  "categoryHint": "GROCERIES",
  "persist": true
}
```

`categoryHint`, `merchantName`, `mcc` are optional; resolver applies precedence documented in `ARCHITECTURE.md`.

### `GET /recommendations?limit=30`

Historical rows (debug / UX).

---

## Transactions (JWT)

### `GET /transactions?limit=50`

### `POST /transactions`

```json
{
  "amount": 12.5,
  "merchantId": "optional-merchant-id",
  "category": "DINING",
  "mcc": "5812",
  "note": "Manual log"
}
```

---

## Health

### `GET /health`

No auth. Used for orchestrator probes.
