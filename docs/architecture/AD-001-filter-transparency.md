# AD-001 — Filter Transparency

**Status:** Accepted  
**Date:** 2026-07-15  
**Scope:** Global UX — all filtered collections in SmartCRM

---

## Decision

All filtered collections within SmartCRM **shall** display:

1. **Filtered count** — how many records match the current view  
2. **Total count** — how many records are available before user-applied filters  
3. **Active filters** — every dimension currently constraining the result set  
4. **Remove filter action** — one control per active filter  
5. **Clear all filters action** — reset the view to the unfiltered collection  

Users shall always understand **why they see the displayed records**.

Filtering shall **never be hidden** behind menus, dropdown labels, or implicit state.

---

## Rationale

- **Transparency** — users trust the system when they can see what shaped the list  
- **Trust** — hidden filters feel like the system is withholding context  
- **Apple Test** — the answer is visible in three seconds without explanation  
- **Decision quality** — commercial and operational choices require knowing what is in (and out of) scope  

SmartCRM prioritizes understanding over record volume. Filter transparency is a structural requirement for that mission — not a cosmetic enhancement.

---

## Requirements

### Display

Every filtered collection must show a count line in this form:

```text
Showing {filteredCount} of {totalCount} {EntityLabel}
```

When any filter is active, an **Active Filters** section must appear immediately below the filter controls — never inside a collapsed panel or dropdown.

Each active filter is shown as `{Label}: {Value}` with a remove action.

When two or more filters are active, **Clear All Filters** must be available.

### Semantics

| Term | Meaning |
|------|---------|
| **Total count** | Records in scope for the workspace before user-applied filters (may include role-based portfolio scope) |
| **Filtered count** | Records matching all active filters and search |
| **Active filter** | Any non-default toolbar value, search query, owner selection, or equivalent constraint |

### Prohibited

- Active filters visible only inside dropdown button labels  
- Filter state that changes the list without a visible active-filter chip  
- Count lines that show only the filtered total with no denominator  

---

## Implementation

### Canonical components

| Component | Path | Role |
|-----------|------|------|
| `FilterTransparencyBar` | `src/components/ui/filter-transparency-bar.tsx` | Count line, active filter chips, clear all |
| `FilterToolbar` | `src/components/ui/filter-toolbar.tsx` | Composes toolbar + transparency bar |
| `buildActiveFilterChips` | `src/lib/workspace-filter-summary.ts` | Derives chips from filter definitions and values |

### Config reference

`FILTER_TRANSPARENCY` in `src/lib/smart-assist-config.ts` — product rules and workspace coverage.

### Covered workspaces (initial)

- Companies  
- Contacts  
- Opportunities  
- Activities (page and embedded)  
- Projects  
- Documents (embedded 360 panels)  
- SmartDocs / Knowledge  
- Intelligence (portfolio signal counts)  
- Search Results (command center)  

New list or table surfaces that accept user filters **must** use `FilterToolbar` with transparency props or `FilterTransparencyBar` directly.

---

## Consequences

### Positive

- Consistent UX across entity workspaces  
- Easier debugging of “why don’t I see X?” support questions  
- SmartAssist filter intents become visible when applied via bridge  

### Constraints

- Every new filtered collection requires total/filtered count plumbing  
- Custom filter UIs (e.g. mode nav) must add an adapter transparency bar  
- Role-based portfolio scope may show filtered ≠ total without removable chips when scope is not user-controlled  

---

## Compliance tests

- **Apple Test** — user sees counts and active filters without instruction  
- **3-Second Test** — user can answer “why these records?” within three seconds  
- **Transparency Principle** — nothing that affects the list is invisible  

---

## Mantra

The system does the thinking. The user makes the decision.

Filter transparency ensures the user has the context required to decide well.
