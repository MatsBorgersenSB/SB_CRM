# SmartCRM for Outlook

Production Outlook add-in for relationship intelligence and meeting briefings, with SharePoint Online as the SmartDocs document backend.

**Host URLs:** `https://sb-crm-seven.vercel.app`

| Surface | Task pane URL |
| --- | --- |
| Relationship Card | `/outlook-addin` |
| Meeting Briefing | `/outlook/meeting-briefing` |
| Manifest | [`manifest.xml`](./relationship-card/manifest.xml) |

## Architecture (dual auth)

1. **SmartCRM SSO** (NextAuth / Azure AD) — identity only. Task panes sign in via Office Dialog when needed.
2. **M365 Graph Connect** (`/api/auth/m365/login`) — encrypted mail + SharePoint tokens on `ExternalIntegration`. Required for drafts, attachment sync, and filing SmartDocs into opportunity folders.

SharePoint folder layout:

```text
/Opportunities/{CompanyName}/{OpportunityTitle}/
```

## Sideload (Outlook on the web or Desktop)

1. Deploy SmartCRM to production (or confirm Vercel is current).
2. In Outlook: **Get Add-ins** → **My add-ins** → **Add a custom add-in** → **Add from file**.
3. Upload `outlook/relationship-card/manifest.xml`.
4. Open a message or calendar item → ribbon **SmartCRM** → **Relationship Card** or **Meeting Briefing**.
5. Sign in with your Microsoft work account when prompted.
6. In the browser app, open `/m365-preview` → **Connect Microsoft 365** and consent to mail + SharePoint scopes.

Centralized deployment (preferred for the tenant): upload the same manifest in Microsoft 365 admin center → Integrated apps / Exchange add-ins.

## Azure / Entra checklist

Same app registration can serve SSO and Graph Connect.

| Item | Value |
| --- | --- |
| Web redirect (SSO) | `https://sb-crm-seven.vercel.app/api/auth/callback/azure-ad` |
| Web redirect (Graph) | `https://sb-crm-seven.vercel.app/api/auth/m365/callback` |
| Delegated permissions | `User.Read`, `Mail.Read`, `Mail.Send`, `Calendars.Read`, `Files.ReadWrite.All`, `Sites.ReadWrite.All` (+ `openid` `profile` `offline_access`) |
| Admin consent | Required for Sites/Files in most tenants |

## Vercel environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` / `AUTH_URL` | `https://sb-crm-seven.vercel.app` |
| `AZURE_AD_CLIENT_ID` / `SECRET` / `TENANT_ID` | Entra app |
| `TOKEN_ENCRYPTION_SECRET` | Encrypt Graph tokens at rest |
| `CRON_SECRET` | Protects `/api/cron/m365-mail-sync` and subscription renew |
| `INTERNAL_DOMAINS` | FS-009 internal vs external mail classification |
| `SHAREPOINT_TRANSPORT` | `graph` |
| `SHAREPOINT_SITE_ID` | Target site for opportunity folders |
| `MICROSOFT_GRAPH_ACCESS_TOKEN` | Optional app/daemon token for folder provision |

Vercel cron (see `vercel.json`):

- `/api/cron/m365-mail-sync` every 10 minutes
- `/api/cron/m365-renew-subscriptions` every 12 hours

## Verify

1. `/m365-preview` → **Connect Microsoft 365** → status shows connected; SharePoint ready when site env is set.
2. Click **Sync mail now** (or wait for cron) → `lastSyncedAt` updates; messages land in Neon as `EmailMessageRecord`.
3. Open an opportunity whose contacts appear in those emails → Email Intelligence shows live threads (Domain filter defaults to **External**).
4. **Draft in Outlook** from the opportunity creates/opens a draft with the connected token.
5. Sideload → open mail → Sign in → Relationship Card loads for a known contact.
6. Unknown sender → **Add contact / company** (confirm role + link or create company) → optional **Create opportunity**.
7. Known contact → **Create opportunity** on the Relationship Card (name, company role, offerings required).
8. Optional: `POST /api/m365/sync-attachments` → DocumentRecord has `sharepointWebUrl`.
9. Unauthenticated `GET /api/m365/relationship-card` returns JSON `401` (not an HTML redirect).
