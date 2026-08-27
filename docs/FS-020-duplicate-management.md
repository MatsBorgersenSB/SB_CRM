# FS-020 – Duplicate Management

## Document Information

| Property | Value |
|----------|-------|
| Specification ID | FS-020 |
| Title | Duplicate Manager |
| Status | Approved |
| Priority | High |
| Category | Data Quality · Company & Contact Registries |
| Version | 1.0 |
| Related | FS-002 Contact Management · FS-003 Company Management · FS-012 Relationship Intake · FS-013 Active Operating Loop · FS-018 Teams Integration |
| Governing standards | SmartCRM Constitution · SmartAssist Constitution · Reality First · Single source of truth |

---

## 1. Problem Statement

Create-time guards reduce new duplicates (organization number, domain), but duplicates still appear when identity fields are missing, types differ for the same legal entity, or contacts land under different company shells.

Contact merge exists in Contact Lifecycle. **Company merge did not.** Admins need a dedicated workspace to detect, explain, and resolve duplicates — without one-off scripts.

---

## 2. Business Goals

1. Keep **one company** and **one contact** per real-world entity.
2. Make duplicates **visible and explainable** (signals + confidence).
3. Resolve with **guided merge** — system recommends; user confirms.
4. Preserve knowledge: remap children, then archive secondary — never invent records.
5. Keep create-time prevention as the first line of defense.

---

## 3. User Stories

| ID | As a… | I want to… | So that… |
|----|-------|------------|----------|
| US-01 | Admin | See scored company duplicate clusters | I know what needs cleanup |
| US-02 | Admin | Understand why two companies match | I can decide with confidence |
| US-03 | Admin | Choose primary and merge | One survivor keeps opportunities and contacts |
| US-04 | Admin | Scan contact duplicates across the portfolio | I can deep-link into existing merge |
| US-05 | Seller | Never auto-lose a company | The system never merges without confirmation |

---

## 4. Functional Requirements

### Detection — companies

SmartCRM shall detect possible duplicate companies using:

| Signal | Confidence |
|--------|------------|
| Same organization number | Certain |
| Same VAT number | High |
| Same normalized website domain | High |
| Normalized legal name (suffix-stripped) | Medium |
| Shared non-personal email domain | Medium |
| Same normalized phone | Medium |

Clusters may contain 2+ companies. Results sorted by highest confidence first.

### Survivorship suggestion

Suggested primary prefers: organization number present → more opportunities → more contacts → richer website/identity → older record as tie-break. User may flip primary.

### Merge — companies

On confirm (ADMIN only):

1. Union company types; fill empty identity fields on primary (never overwrite non-empty with empty).
2. Reassign contacts, opportunities, notes, documents, meetings, health, and expansion rows to primary.
3. On contact email collision with an existing primary contact: keep primary contact; archive the colliding secondary contact.
4. Archive secondary company (`status: archived`).
5. Write audit `COMPANY_MERGED`.

Never hard-delete. Never auto-merge.

### Contacts

Portfolio scan reuses Contact Lifecycle duplicate rules (same email; same name at company; same name + phone). Resolution deep-links to existing Contact 360 merge wizard.

### Permissions

- View Duplicate Manager: ADMIN (`superuser` / `admin`)
- Merge companies: ADMIN only

---

## 5. SmartAssist Behaviour

- Observe before asking: scan registries first.
- Recommend primary with plain-language reasons.
- Never invent a third company to “resolve” a conflict.
- User makes the merge decision.

---

## 6. UX Design

**Route:** `/administration/duplicates`  
**Entry:** Administration → Duplicate Manager

3-second test:

1. What am I looking at? (duplicate clusters needing attention)
2. What matters? (certain / high matches first)
3. What next? (choose primary → confirm merge)

Michelin: one workspace, two tabs (Companies · Contacts). No widget sprawl.

---

## 7. Reality First

- Only real registry rows appear.
- Demo seed companies excluded from scans.
- Unknown stays unknown — missing org number does not invent a match beyond defined signals.

---

## 8. Persistence / Ownership

- Prisma Company / Contact registries are source of truth.
- Secondary company remains archived for audit trail.
- Create-time org number / domain blocks remain in FS-003 / company-registry.

---

## 9. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01 | Admin opens Duplicate Manager and sees company clusters with reason chips |
| AC-02 | Certain (org number) matches rank above medium name-only matches |
| AC-03 | Merge remaps opportunities and contacts to primary and archives secondary |
| AC-04 | Types are unioned (e.g. Prospect + Partner → one company) |
| AC-05 | Non-ADMIN cannot merge |
| AC-06 | Contacts tab lists portfolio duplicates and links to existing merge |
| AC-07 | No silent / automatic merges |
| AC-08 | Admin can dismiss a cluster as “Not a duplicate”; it leaves the open queue |
| AC-09 | Company 360 shows a possible-duplicate hint for ADMIN with link to Duplicate Manager |

---

## 10. Phases

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Company detect + merge · Contacts portfolio scan · Admin workspace | Shipped |
| **2** | Dismiss / suppress false positives · Company 360 hint · merge preview | In product |

---

## 11. Out of Scope (v1)

- Auto-merge
- Fuzzy ML / embeddings
- Bulk merge-all
- Outlook / Teams intake merge wizard (FS-012)
- ERP identity (FS-019)
