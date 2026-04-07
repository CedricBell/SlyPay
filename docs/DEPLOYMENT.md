# Déploiement SpendLess (lien public + admin)

Architecture recommandée pour un MVP partageable :

| Composant | Service suggéré | Rôle |
|-----------|-----------------|------|
| **PostgreSQL** | [Railway](https://railway.app), [Neon](https://neon.tech), [Supabase](https://supabase.com), ou RDS | Base de données |
| **API NestJS** | Railway, [Render](https://render.com), [Fly.io](https://fly.io) | `Dockerfile` dans `backend/` |
| **Frontend Next.js** | [Vercel](https://vercel.com) | Dossier `frontend/` |

Tu obtiens : **URL Vercel** pour le site (à envoyer aux testeurs) et **URL API** pour `NEXT_PUBLIC_API_URL`.

---

## 1. Base PostgreSQL

1. Crée une base managée (Railway “Postgres”, Neon, etc.).
2. Copie l’URL **PostgreSQL** (format `postgresql://user:pass@host:5432/db?sslmode=require`).

---

## 2. API (ex. Railway)

1. Nouveau projet → **Deploy from GitHub** (ou upload du repo).
2. **Root directory** : `backend` (important pour un monorepo).
3. **PostgreSQL sur Railway** : dans le même projet, **+ New** → **Database** → **Add PostgreSQL**. Sur le service Postgres → **Variables** : récupère `DATABASE_URL`. Sur ton service **API** → **Variables** → **Add variable** → **Reference** → sélectionne Postgres → variable `DATABASE_URL` (comme ça l’URL suit la base).
4. Le fichier **`backend/railway.toml`** indique à Railway d’utiliser le **Dockerfile** (sinon Nixpacks peut démarrer `node dist/main.js` sans avoir lancé `nest build` → erreur *Cannot find module '/app/dist/main.js'*). Après `git push`, clique **Redeploy**.
5. **Dockerfile** : celui du repo (`backend/Dockerfile` déjà prévu).
6. Variables d’environnement :

| Variable | Exemple / note |
|----------|----------------|
| `DATABASE_URL` | URL fournie par le provider Postgres |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` (long, secret) |
| `JWT_ACCESS_EXPIRES` | `15m` |
| `JWT_REFRESH_DAYS` | `14` |
| `PORT` | `4000` (ou laisser Railway injecter `PORT` et adapter le Dockerfile si besoin) |
| `CORS_ORIGIN` | URL(s) du front, **sans slash final** : `https://ton-app.vercel.app` (plusieurs séparées par des virgules) |
| `SEED_ADMIN_EMAIL` | (optionnel) ton email **après** inscription — voir section Admin |

7. **Commande de démarrage** : avec `railway.toml`, c’est déjà `migrate + seed + node dist/main.js`. Sinon, dans l’UI Railway (**Settings** → **Deploy** → **Custom Start Command**) :

```bash
npx prisma migrate deploy && npx prisma db seed && node dist/main.js
```

Sans `railway.toml`, mets cette ligne dans **Custom Start Command**.

8. Note l’URL publique HTTPS de l’API, ex. `https://spendless-api-production.up.railway.app`.

**Healthcheck** : `GET https://…/api/v1/health`

---

## 3. Frontend (Vercel)

1. Import du repo GitHub, **Root Directory** : `frontend`.
2. Variables :

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://TON-API.up.railway.app/api/v1` (inclure `/api/v1`) |

3. Déploie. L’URL Vercel (`https://….vercel.app`) est celle à **partager**.

4. Retourne sur l’API et mets à jour **`CORS_ORIGIN`** avec l’URL Vercel exacte, puis redéploie l’API si nécessaire.

---

## 4. Devenir administrateur

1. Ouvre le site en production, **inscris-toi** avec l’email que tu veux utiliser comme admin.
2. Dans les variables de l’API, définis **`SEED_ADMIN_EMAIL`** = cet email (minuscules).
3. Relance **une fois** le seed (redeploy avec commande incluant `npx prisma db seed`, ou exécute le seed manuellement depuis une console avec les mêmes env).

Le seed promeut ce compte en **`ADMIN`**.

4. **Déconnecte-toi et reconnecte-toi** pour recevoir un JWT contenant `role: ADMIN`.

Ensuite : lien **Admin** dans la barre de navigation → `/admin/users` : liste des comptes, désactivation, promotion / retrait admin.

---

## 5. Sécurité (production)

- Ne commite jamais `.env` ; secrets uniquement dans le dashboard du PaaS.
- `JWT_ACCESS_SECRET` unique et long.
- Retire ou change le compte **demo** en prod (`demo@spendless.dev`) si le seed le recrée.
- HTTPS partout (Vercel / Railway le fournissent par défaut).

---

## 6. Dépannage

| Problème | Piste |
|----------|--------|
| CORS dans le navigateur | `CORS_ORIGIN` doit correspondre **exactement** à l’origine du front (schéma + host, pas de slash final). |
| API 401 après promo admin | Nouveau login pour rafraîchir le JWT. |
| Migrations | `npx prisma migrate deploy` doit réussir avant `node dist/main.js`. |

Pour le détail des routes : [`docs/API.md`](./API.md).
