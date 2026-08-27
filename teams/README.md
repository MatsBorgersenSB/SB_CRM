# SmartCRM for Teams (FS-018)

**Host:** `https://sb-crm-seven.vercel.app`  
**Spec:** [`docs/FS-018-teams-integration.md`](../docs/FS-018-teams-integration.md)

| Phase | Surface | URL |
|-------|---------|-----|
| 1 | Daily Focus (personal) | `/teams/daily-focus` |
| 1 | Meeting Briefing | `/teams/meeting-briefing?email=` or `?companyId=` |
| 1 | Meeting tab config | `/teams/meeting-briefing/config` |
| 2 | Account Workspace (channel) | `/teams/account-workspace?companyId=` or `?projectId=` |
| 2 | Channel tab config | `/teams/account-workspace/config` |
| | Manifest | [`manifest.json`](./manifest.json) **v1.1.0** |

## Design rules

- No CRM iframes / full Mission Control in Teams
- Daily Focus = **exactly 4 blocks**
- Meeting Briefing = **7 sections**
- Account Workspace = **max 7 blocks**
- Opportunity CTAs stay sell-to gated; Project bind is always allowed

## Sideload (developer)

1. Deploy so `/teams/*` is live.
2. Set `webApplicationInfo.id` in `manifest.json` to your Azure AD app client id.
3. Zip `manifest.json`, `color.png`, and `outline.png`.
4. Teams → Apps → Upload a custom app.
5. Personal: **Daily Focus**.
6. Channel: **+** → SmartCRM → choose company or project (e.g. Escalante) → Save.

## Browser preview

- Account Workspace: `/teams/account-workspace?projectId=PRJ-CARBON-EMERGENTE` or `?companyId=CO-…`
- Also validate via `/m365-preview`

## Later phases

- Phase 3: Message extension Assign + FS-014
- Phase 4: Durable channel binding table + weekly attention cards
