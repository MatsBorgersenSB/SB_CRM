# SmartCRM for Teams (FS-018)

Phase 1 — **Daily Focus** (personal app) + **Meeting Briefing** (meeting side panel).

**Host:** `https://sb-crm-seven.vercel.app`  
**Spec:** [`docs/FS-018-teams-integration.md`](../docs/FS-018-teams-integration.md)

| Surface | URL |
|---------|-----|
| Daily Focus | `/teams/daily-focus` |
| Meeting Briefing | `/teams/meeting-briefing?email=` or `?companyId=` |
| Meeting tab config | `/teams/meeting-briefing/config` |
| Manifest | [`manifest.json`](./manifest.json) |

## Design rules

- No CRM iframes / full Mission Control in Teams
- Daily Focus = **exactly 4 blocks** (who to engage · at risk · commitment · NBA)
- Meeting Briefing = **7 sections** (same engine as Outlook)
- Sign-in CTA when session missing (same dialog pattern as Outlook)

## Sideload (developer)

1. Deploy SmartCRM so `/teams/*` is live.
2. Set `webApplicationInfo.id` in `manifest.json` to your Azure AD app (client) id.
3. Zip `manifest.json`, `color.png`, and `outline.png`.
4. Teams Admin / Teams → Apps → Manage your apps → Upload a custom app.
5. Open **SmartCRM** personal app → **Daily Focus**.
6. Sign in when prompted.
7. For briefing: open `/teams/meeting-briefing?email=person@customer.com` (attendee auto-resolve is Phase 1.1).

## Azure / Entra

Reuse the SmartCRM app registration:

| Item | Value |
|------|-------|
| Web redirect (SSO) | `https://sb-crm-seven.vercel.app/api/auth/callback/azure-ad` |
| Teams application ID URI | `api://sb-crm-seven.vercel.app/{clientId}` |
| Valid domains | `sb-crm-seven.vercel.app` |

## Browser preview (no Teams)

- Daily Focus: `https://sb-crm-seven.vercel.app/teams/daily-focus` (after web sign-in)
- Briefing: `https://sb-crm-seven.vercel.app/teams/meeting-briefing?email=…`
- Also validate via `/m365-preview`

## Out of scope (later phases)

- Channel Account Workspace tab (Phase 2)
- Message extension Assign (Phase 3)
- Channel ↔ project binding (Phase 4)
- Live meeting bot
