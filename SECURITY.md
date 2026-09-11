# Security notes

## Secrets

- Never commit `.env`, `.env.local`, or real API keys.
- Use the `*.env.example` files as templates only (placeholders).
- Rotate any credential that may have appeared in git history (API keys, DB passwords, JWT secrets).

## Production checklist

- Restrict Google Maps / Places keys by HTTP referrer and/or IP.
- Do not enable `SEED_ADMIN_EMAIL` on a shared public deployment unless you control that inbox.
- Disable or change the local Docker demo account (`demo@spendless.dev`) on any internet-facing environment.
- Keep Supabase RLS / auth policies aligned with your data model; the anon key is public by design — protect privileged operations server-side.
- Prefer managed secrets (Vercel / Railway / AWS Secrets Manager) over env files on disk.

## Reporting

If you find a security issue in this repository, open a private report with the maintainer rather than filing a public issue with exploit details.
