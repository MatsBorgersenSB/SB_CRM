# SmartCRM for Teams (FS-018)

**Host:** `https://sb-crm-seven.vercel.app`  
**Spec:** [`docs/FS-018-teams-integration.md`](../docs/FS-018-teams-integration.md)  
**Package:** [`manifest.json`](./manifest.json) **v1.2.0** (FS-018 v1 complete)

| Phase | Surface | URL |
|-------|---------|-----|
| 1 | Daily Focus | `/teams/daily-focus` |
| 1 | Meeting Briefing | `/teams/meeting-briefing` |
| 2 | Account Workspace | `/teams/account-workspace` |
| 2 | Channel config | `/teams/account-workspace/config` |
| 3 | Assign message | `/teams/assign-message` |
| 3 | Post-meeting notes | `/teams/post-meeting` |
| 4 | Channel binding API | `/api/teams/channel-binding` |
| 4 | Attention Adaptive Card JSON | `/api/teams/attention-card?teamId=&channelId=` |
| 3 | Bot (task modules) | `/api/teams/bot` |

## Sideload

1. Deploy `/teams/*` and `/api/teams/*`.
2. Set every `REPLACE_WITH_AZURE_AD_CLIENT_ID` in `manifest.json` to the Entra app id.
3. Register the same app as a Teams bot messaging endpoint:  
   `https://sb-crm-seven.vercel.app/api/teams/bot`
4. Zip `manifest.json`, `color.png`, `outline.png` → upload custom app.

## Channel bind

Saving the Account Workspace tab stores `companyId`/`projectId` in the tab URL **and** persists `TeamsChannelBinding` (`teamId` + `channelId`). Unbind via `DELETE /api/teams/channel-binding`.

## Attention cards

`GET /api/teams/attention-card` returns Adaptive Card JSON (≤4 facts). Post via Flow/bot on a schedule — proactive weekly push is optional ops wiring, not required for product v1.

## Deferred (ops / later)

- Graph live meeting transcript pull
- Planner task create from approved commitments
- Auto-bind by channel name (never without confirm)
