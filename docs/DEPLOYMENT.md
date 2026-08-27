# SmartCRM Production Deployment

Step-by-step playbook for running SmartCRM in production with Docker Compose, PostgreSQL 16, and the Next.js standalone server.

---

## 1. Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Access to this repository
- Secrets for production (do **not** commit real values)

Optional: Node.js 20+ if you prefer host-side `prisma migrate` against the Compose Postgres.

---

## 2. Environment variables checklist

Copy `.env.example` to `.env` (Compose loads `.env` from the project root automatically).

| Variable | Required | Notes |
| :--- | :---: | :--- |
| `DATABASE_URL` | Yes | Postgres URL used by the app / Prisma adapter. In Compose default: `postgresql://postgres:postgres@postgres:5432/smartcrm?schema=public` |
| `DIRECT_URL` | Yes | Same as `DATABASE_URL` unless using a pooler (then DIRECT_URL = direct Postgres). |
| `TOKEN_ENCRYPTION_SECRET` | Yes (prod) | AES-256-GCM key material for M365 OAuth tokens at rest. **Must** be set in production. |
| `CRON_SECRET` | Recommended | Protects `/api/cron/*` (Bearer or `x-cron-secret`). Required for mail sync + subscription renew. |
| `NEXT_PUBLIC_APP_URL` | Yes | Public origin (OAuth redirects, Outlook deep links), e.g. `https://crm.example.com`. |
| `INTERNAL_DOMAINS` | Recommended | Comma-separated host domains for FS-009 privacy classification. |
| `SHAREPOINT_TRANSPORT` | For docs | `local` (default) or `graph` (SharePoint Online SoT for SmartDocs). |
| `SHAREPOINT_SITE_ID` | If graph | Graph site id for opportunity folders / SmartDocs. |
| `AZURE_AD_*` / `AZURE_*` | If M365 | Entra app for SSO + Graph OAuth (same app is fine). |
| `M365_OAUTH_SCOPES` | Optional | Defaults: mail/calendar + Files.ReadWrite.All + Sites.ReadWrite.All. |
| `MICROSOFT_GRAPH_ACCESS_TOKEN` | Optional | App/daemon token for SharePoint folder ops; else delegated Connect token. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose | Postgres container bootstrap (defaults: `postgres` / `postgres` / `smartcrm`). |
| `APP_PORT` | Optional | Host port mapped to container `3000` (default `3000`). |
| `APP_VERSION` | Optional | Reported by `/api/health` (default `1.0.0`). |

**Never** bake secrets into the image. Pass them via Compose `environment`, an orchestrator secret store, or a mounted env file that is gitignored.

---

## 3. Docker deployment

From the repository root:

```bash
# Build images and start Postgres + web in the background
docker compose up -d --build

# Follow logs
docker compose logs -f web

# Stop
docker compose down
```

First boot order:

1. `postgres` becomes healthy (`pg_isready`).
2. `web` starts the Next.js standalone server on port **3000**.
3. Apply schema migrations (see below) before relying on CRM pages.

Useful checks:

```bash
docker compose ps
curl -sS http://localhost:3000/api/health
```

---

## 4. Database migration strategies

SmartCRM uses Prisma Migrate (`prisma/migrations`). Choose one approach per environment.

### A. One-shot migrate from a jump host (recommended)

With Compose Postgres published on `localhost:5432` (or a tunnel):

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartcrm?schema=public"
export DIRECT_URL="$DATABASE_URL"

npx prisma migrate deploy
npx prisma generate   # if running tools on the host
```

`migrate deploy` applies committed migrations only — safe for production.

### B. Ephemeral migrate container

```bash
docker compose run --rm --entrypoint sh web -c \
  "npx prisma migrate deploy"
```

Ensure the `web` image (or a dedicated migrate image) includes the Prisma CLI and `prisma/migrations`. The production runner image is slim; prefer a CI job or jump host for `migrate deploy` if the runner does not ship `node_modules/prisma`.

### C. Seed (purge invented demo only)

`npx prisma db seed` **deletes** invented Prisma demo records (Acme Renewables, Global TechCorp, and the seed copy of Standard Bio). It does **not** insert companies, contacts, or opportunities.

Do **not** re-introduce demo companies into the live registry. Reality First: unknown over fiction.

### Rollback posture

- Prefer forward-fix migrations.
- For emergency schema rollback, restore a Postgres volume snapshot / backup taken before `migrate deploy`.

---

## 5. Health check monitoring

### Endpoint

`GET /api/health`

**Healthy (HTTP 200):**

```json
{
  "status": "ok",
  "timestamp": "2026-07-23T09:00:00.000Z",
  "database": "connected",
  "version": "1.0.0"
}
```

**Unhealthy (HTTP 503):** database probe failed (`SELECT 1` via Prisma).

### Docker HEALTHCHECK

The `Dockerfile` probes `http://127.0.0.1:3000/api/health` every 30s.

### External monitoring

Point uptime checks (Datadog, Pingdom, Azure Monitor, etc.) at:

```text
https://<your-host>/api/health
```

Alert on non-200 or when `database` ≠ `connected`.

---

## 6. Standalone build notes

`next.config.ts` sets `output: "standalone"`. The Docker multi-stage build:

1. **deps** — `npm ci`
2. **builder** — `prisma generate` + `next build`
3. **runner** — Node 20 Alpine, non-root user `nextjs`, `node server.js` on port 3000

Local standalone smoke test (optional):

```bash
npm ci
npx prisma generate
npm run build
node .next/standalone/server.js
```

---

## 7. CI/CD

GitHub Actions workflow: `.github/workflows/ci.yml`

On push/PR to `main` or `develop`:

1. Checkout  
2. Setup Node 20 (npm cache)  
3. `npm ci`  
4. `npx prisma generate`  
5. `npx tsc --noEmit`  
6. `npm run build`

Deploy pipelines should run `prisma migrate deploy` against the target database **before** or **as part of** cutting traffic to a new web revision.

---

## 8. Production hardening checklist

- [ ] Unique `TOKEN_ENCRYPTION_SECRET` (long random string)
- [ ] Strong `POSTGRES_PASSWORD` (not the Compose default)
- [ ] `NEXT_PUBLIC_APP_URL` matches the public TLS hostname
- [ ] TLS termination (reverse proxy / load balancer) in front of port 3000
- [ ] `CRON_SECRET` set for M365 mail sync cron (`/api/cron/m365-mail-sync`) and subscription renewal
- [ ] Backups enabled for the `smartcrm_postgres_data` volume
- [ ] `/api/health` monitored
- [ ] OAuth redirect URIs registered for `{NEXT_PUBLIC_APP_URL}/api/auth/callback/azure-ad` (SSO) and `{NEXT_PUBLIC_APP_URL}/api/auth/m365/callback` (Graph)
- [ ] Admin consent for Mail.* + Files.ReadWrite.All + Sites.ReadWrite.All when using SharePoint document backend
- [ ] `SHAREPOINT_TRANSPORT=graph` and `SHAREPOINT_SITE_ID` set when filing SmartDocs to SharePoint
- [ ] After Connect: Sync mail now on `/m365-preview` (or wait for Vercel cron) and confirm opportunity Email Intelligence
- [ ] Outlook add-in sideload or central deploy of `outlook/relationship-card/manifest.xml` (see `outlook/README.md`)

---

*End of deployment playbook.*
