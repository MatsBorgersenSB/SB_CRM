# SmartCRM Outlook Add-in — Manifest Validation Report

**Date:** 2026-08-10  
**Auditor:** Outlook Add-in expert audit (repo)  
**Source of truth:** `outlook/relationship-card/manifest.xml`  
**Backup of previous:** `outlook/relationship-card/manifest.v1.3.2.backup.xml`  
**Production host:** `https://sb-crm-seven.vercel.app`  
**Retired host (must not appear in SourceLocation):** `https://smart-crm-outlook-plugin-phi.vercel.app`  
**Manifest version:** `1.4.1.0`

---

## Executive verdict

The previous manifest was **schema-valid** (`office-addin-manifest validate` passed) and listed Outlook on the web as a supported platform, but it was **weak for modern Outlook Web / new Outlook** for three practical reasons:

1. **Missing nested `VersionOverridesV1_1`** — Outlook on the web and new Outlook prioritize V1_1. V1_0-only is insufficient for modern command surfaces / pinning; Microsoft’s required dual-schema pattern is V1_0 parent + nested V1_1 child with **duplicated** Hosts/Resources.
2. **Icon pixel sizes were wrong** — `icon-64.png` and `icon-128.png` were both **1024×1024** (~831 KB identical files). Mail add-ins require **64×64** and **128×128**; command icons need **16 / 32 / 80**. Wrong sizes commonly cause “installed but invisible / broken ribbon” behavior.
3. **AppDomains listed the add-in host** (redundant) and **omitted Microsoft login hosts** needed for Office Dialog sign-in.

Task pane URLs themselves load over HTTPS with **no `X-Frame-Options` / `frame-ancestors` block** in live headers — framing is not the primary “hidden” cause.

---

## Severity legend

| Severity | Meaning |
| --- | --- |
| **ERROR** | Likely blocks visibility, install refresh, or AppSource/client acceptance |
| **WARNING** | Valid but risky / incomplete for Outlook Web or production UX |
| **INFO** | Observation / recommendation |

---

## Full findings (pre-fix → post-fix)

### Schema / structure

| ID | Severity | Finding | Status after fix |
| --- | --- | --- | --- |
| S1 | WARNING | Only `VersionOverridesV1_0` present; no nested `VersionOverridesV1_1` for Outlook Web / new Outlook | **Fixed** — nested V1_1 with duplicated Hosts/Resources |
| S2 | INFO | Unused xmlns `mailappor` | **Fixed** — removed |
| S3 | INFO | Host `Mailbox` + `MailHost` correct (not “Mail”) | OK |
| S4 | INFO | `DesktopFormFactor` correctly covers Outlook Web, Windows, Mac (there is no separate Web FormFactor) | OK |
| S5 | INFO | ExtensionPoints `MessageReadCommandSurface`, `AppointmentOrganizerCommandSurface`, `AppointmentAttendeeCommandSurface` are valid | OK |
| S6 | INFO | No `MessageComposeCommandSurface` — add-in will **not** appear while composing | By design (document for users) |
| S7 | WARNING | No `SupportsPinning` (V1_1-only feature) | **Fixed** on message-read task panes |
| S8 | INFO | `MobileFormFactor` absent — mobile not supported | Acceptable; not required for Outlook Web |
| S9 | INFO | `WebApplicationInfo` absent — OK while using Office Dialog + NextAuth; do **not** add stub SSO | Documented; omitted intentionally |
| S10 | WARNING | Version needed bump for re-sideload after material change | **Fixed** — `1.3.2.0` → `1.4.0.0` |

### Resources / IDs

| ID | Severity | Finding | Status after fix |
| --- | --- | --- | --- |
| R1 | ERROR | `IconUrl` / `HighResolutionIconUrl` pointed at 1024×1024 PNGs | **Fixed** — true 64×64 / 128×128 generated |
| R2 | ERROR | Command icons `icon16`/`icon32`/`icon80` reused 64/128 assets (wrong pixels) | **Fixed** — dedicated `icon-16/32/80.png` |
| R3 | INFO | All `resid` references (`groupLabel`, `relCardLabel`, `briefLabel`, `relCardTip`, `briefTip`, `relCardUrl`, `briefUrl`, `icon16/32/80`) resolved | OK (both V1_0 and V1_1 Resources) |
| R4 | INFO | Group/Control IDs unique and ≤125 chars | OK (normalized to `SmartCRM.*` prefixes) |
| R5 | INFO | Short/Long string lengths within limits | OK |
| R6 | WARNING | `AppDomain` for `https://sb-crm-seven.vercel.app` is redundant with SourceLocation | **Fixed** — removed host; added login hosts |

### Outlook Web / New Outlook / Desktop

| Client | Pre-fix risk | Post-fix |
| --- | --- | --- |
| Outlook on the web (M365) | High — V1_0-only + bad icons | V1_1 commands + correct icons |
| New Outlook on Windows | High — same | Same |
| Classic Outlook desktop | Lower — V1_0 often enough | Still covered by V1_0 parent |
| Outlook on Mac | Medium | Covered via DesktopFormFactor |
| Mobile (iOS/Android) | Not configured | Still not configured |

### Permissions / activation

| ID | Severity | Finding |
| --- | --- | --- |
| P1 | INFO | `Permissions` = `ReadItem` — sufficient for Relationship Card read scenario |
| P2 | INFO | Activation rules: Message **Read** OR Appointment **Read** only |
| P3 | WARNING | User must **open a message/appointment in read mode**; Manage Add-ins “Added” ≠ ribbon visibility |
| P4 | INFO | In modern Outlook Web, commands often sit under **Apps** flyout, not a permanent home-tab group |

### Framing / CSP (task pane host)

| ID | Severity | Finding |
| --- | --- | --- |
| H1 | INFO | Live `GET /outlook-addin` → 200, HTTPS, **no** `X-Frame-Options`, **no** restrictive CSP `frame-ancestors` observed |
| H2 | INFO | `next.config.ts` sets no security headers that would block Office iframes |
| H3 | INFO | Middleware allows unauthenticated `/outlook-addin` and `/outlook/*` (Sign-in CTA path) — correct |
| H4 | WARNING | New icon files must be **deployed to Vercel** before re-sideload, or ribbon icons 404 |

### WebApplicationInfo / SSO

| ID | Severity | Finding |
| --- | --- | --- |
| W1 | INFO | Not required for task pane load |
| W2 | WARNING | Incomplete/stub `WebApplicationInfo` can hide or break add-ins — **do not add** until Entra `api://…/access_as_user` is real |

---

## `office-addin-manifest validate` output

### Pre-fix (`1.3.2.0`)

Validator reported: **The manifest is valid.**  
Platforms listed included Outlook on the web, Windows, Mac.  
Note: validator does **not** verify actual PNG pixel dimensions.

### Post-fix (`1.4.0.0`)

`npx office-addin-manifest validate outlook/relationship-card/manifest.xml` → **The manifest is valid.**

Supported platforms reported: Outlook on Windows (Microsoft 365), Outlook 2019+ Windows, Outlook 2016+/2019+ Mac, **Outlook on the web**, Outlook on Mac (Microsoft 365). Mobile not included (no MobileFormFactor).

---

## V1_0 vs V1_1 recommendation

**Upgrade to nested V1_1 (done).**

Per Microsoft Learn: when using mail VersionOverrides 1.1, it **must** be the last child of a VersionOverrides 1.0 parent. Child does **not** inherit — duplicate Requirements, Hosts, Resources. Outlook Web / new Outlook consume V1_1 when present.

---

## Diff summary (what changed)

- Version `1.3.2.0` → `1.4.0.0`
- Nested `VersionOverridesV1_1` with full duplicate command surfaces
- `SupportsPinning` on Relationship Card + Meeting Briefing (message read)
- Icon URLs → `/assets/icon-16.png`, `icon-32.png`, `icon-80.png` (+ corrected 64/128)
- AppDomains → `login.microsoftonline.com`, `login.windows.net`
- Removed unused `mailappor` xmlns
- Normalized Group/Control IDs
- Generated `public/assets/icon-{16,32,64,80,128}.png` from `icon-source-1024.png`

---

## Re-sideload / deploy steps

1. **Deploy** this repo to Vercel so `/assets/icon-16.png` … `icon-128.png` are live.
2. Confirm icons: open each URL in a browser; verify they are small PNGs (not 1024×1024).
3. In Outlook Web: **Get add-ins** → **My add-ins** → remove previous SmartCRM if present.
4. **Add a custom add-in** → **Add from file** → upload `outlook/relationship-card/manifest.xml` (version **1.4.0.0**).
5. Open an **existing email in read mode** (not compose).
6. Look under ribbon **Apps** / **SmartCRM** for **Relationship Card** and **Meeting Briefing**.
7. Optional tenant-wide: M365 admin center → Integrated apps / Exchange add-ins → upload same manifest.

Central deploy may take minutes to propagate; sideload is immediate per user.
