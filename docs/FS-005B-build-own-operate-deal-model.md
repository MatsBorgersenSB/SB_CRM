# FS-005B Build-Own-Operate Deal Model

## Document Information

| Property | Value |
|-----------|-----------|
| Specification ID | FS-005B |
| Name | Build-Own-Operate Deal Model (addendum to FS-005 and FS-005A) |
| Parent | FS-005 Opportunity Workspace |
| Related | FS-005A Deal Brief, FS-022 Sales Pipelines, FS-003 Company Management, FS-004 Relationship Intelligence |
| Status | Approved for build (open questions decided, section 15) |
| Owner | SmartCRM |
| Category | Core Capability |

---

## 1. Problem Statement

SmartCRM assumes every plant opportunity is a **sale of a plant to a customer**. Standard Bio also **develops, owns and operates** plants (Build-Own-Operate, BOO). The first example is a pyrolysis plant planned next to Antec's biogas plant.

In a BOO deal the counterparty is not a buyer of the plant. Standard Bio carries the capital. The questions that decide the deal are different:

1. Understanding asks about the customer's **budget** and **economic buyer**. Neither applies when we fund the plant.
2. The sales motion is guessed from offerings only (`resolveSalesMotion`). Offerings say *what* we provide, not *how we make money from it*, so a BOO deal is silently treated as a sale.
3. Counterparties are **suppliers, hosts and neighbours**. The relationship rules say never create opportunities for suppliers, and the Brief (FS-005A 5.9) hides itself for buy-from companies. Both are wrong here.
4. The pipeline (FS-022) has no stages for securing feedstock, site, permits and financing.

## 2. Business Goals

- Let the user **choose how a deal is done** (sell, build-own-operate, product, consulting).
- For BOO, answer: **Can we secure feedstock, site and offtake, and can the plant be funded, permitted and built?**
- Keep the SmartCRM rules intact: Reality First, system recommends and user decides, relationship posture is respected.

## 3. User Stories

- As a developer I choose "Build-Own-Operate" on Antec Hornindal and the workspace stops asking about the customer's budget.
- As a developer I see at a glance whether feedstock, site, permits and funding are secured, and which one blocks the plant.
- As a developer I can record that Antec is both a feedstock supplier and a customer for disposal, without misclassifying the company.
- As a developer I track investor and public funding (grants, subsidies) separately.

## 4. Deal Model

A deal has one **deal model**, chosen by the user.

| Model | Meaning | Motion profile |
|---|---|---|
| Sell the system | Customer buys and owns the plant | `system` (today) |
| Build-Own-Operate | We develop, fund, own and operate | `boo` (new) |
| Product sale | Quote, order, deliver | `product` |
| Consulting | Scope, fee, deliver | `consulting` |

### 4.1 Resolution

1. If the user has chosen a model, it wins. Source shown as "Chosen by {user}".
2. Otherwise the offerings-derived guess applies, shown as **Assumed** with a one-click confirm. SmartAssist suggests; the user decides.
3. No offerings and no choice: **Unclassified**, with full investigation (unchanged).

Existing deals load without migration and behave as today. The offerings-derived guess never selects `boo`; only the user does.

### 4.2 Changing the model

Switching model never deletes answers. Fields not used by the new model are hidden, not discarded, and reappear if the user switches back.

### 4.3 First example: Antec Hornindal (Vest Biogas)

Stated by the user (4–5 Nov 2026):
- Standard Bio is developing a pyrolysis plant in direct proximity to Antec's **Vest Biogas** plant.
- **Land plot (`site_readiness`):** A land plot (`~80 x 120 m²`) in direct proximity to Vest Biogas is available, but **rent/lease vs. ownership and terms are not yet decided (to be determined)** and must be secured.
- **Utilities (`utilities`):** Ducts and piping for thermal heat exchange are partly prepared, and utility capacity data and tie-in terms with Vest Biogas **must be confirmed and secured**.
- **Ownership and financing:** How the financial and ownership structure ends up (full Standard Bio BOO, joint venture / co-ownership, investor equity, project finance, public subsidies) is **yet to be discussed** and is not pre-assumed.
- **Public funding and subsidies (`public_funding`):** Standard Bio **qualifies for subsidies** and **must apply**.
- **Permits (`permitting`):** Standard Bio **must apply for a separate permit** for the pyrolysis plant and new dryer (expected to fast-track as it strengthens the biogas operation).
- **Feedstock (baseline):** Standard Bio secures **wood chips** for the Standard Bio pyrolysis plant.
- **Confirmed commercial scope with Vest Biogas (`offtake_strategy`):** Standard Bio **sells the surplus thermal heat** (`~7–8 GWh/year`) from the pyrolysis plant to Vest Biogas (for example, to dry their digestate and support the biogas operation).
- **Biochar product offtake (`end_product`):** Standard Bio must also **secure offtake for the biochar product** produced from the wood chips (buyers, specification, pricing, and carbon credits).
- **Open option (not yet decided):** Vest Biogas *might* also want Standard Bio to pyrolyse/treat their dried digestate, but that is **not yet decided** and is not assumed.

Vest Biogas therefore plays these roles on the deal — each recorded only when confirmed, and never inferred automatically:

| Role | What it is | Status at Antec | Posture |
|---|---|---|---|
| Thermal energy offtaker | Buys surplus thermal heat from Standard Bio's pyrolysis plant | **Active scope** | Sell-to |
| Neighbour and site partner | Adjacent plant; shared utilities and logistics | **Active scope** | Collaborate |
| Dried digestate treatment / feedstock | Optional pyrolysis of Vest Biogas's dried digestate | **Undecided option** (baseline feedstock is wood chips secured by Standard Bio) | Buy-from / Sell-to |

Energy price, thermal form (steam, hot water, temperature), volume (MWh/year), wood-chip supply terms, and whether dried digestate will be treated are **Unknown** until captured.

## 5. BOO Understanding

Plain language only. Existing fields are reused; reworded for BOO where noted.

| Field | BOO wording | Status |
|---|---|---|
| `customer_problem` | What the host or supplier needs solved (e.g. digestate disposal) | Reworded |
| `why_now` | Why now | Same |
| `customer_value` | What it is worth to them (e.g. disposal cost avoided) | Reworded |
| `decision_maker` | Who signs the feedstock and site agreements | Reworded |
| `feedstock_volume` | Committed volume | Same |
| `feedstock_quality` | Quality and consistency | Same |
| `feedstock_agreement` | **Feedstock agreement:** status, term, price or gate fee | **New** |
| `site_readiness` | Site control: our lease or purchase of the property, and access (Standard Bio leases or owns the site; a landowner is not a deal counterparty) | Reworded |
| `utilities` | Shared utilities with the neighbouring plant (heat, power, logistics) | Reworded |
| `permitting` | Permits and authorities | Same |
| `offtake_strategy` | **Energy and heat offtake:** who buys the surplus thermal energy (heat/steam/power), on what terms and price | Reworded |
| `end_product` | **Biochar product offtake:** buyers, specification, volume, pricing and carbon credits for the biochar product | Reworded |
| `funding_source` | **Ownership and financing:** how ownership and capital are structured (BOO, JV, investors, project finance) — often undecided in early stages | Reworded |
| `public_funding` | **Public funding and subsidies:** schemes identified, applied, granted | **New** |
| `capacity`, `technical_fit`, `timeline`, `stakeholder_map`, `business_case_strength` | Plant-level, as today | Same |
| `economic_buyer`, `budget` | Not asked in BOO (customer pays nothing for the plant) | Hidden |
| `customer_vision` | Optional | Same |

Each answer keeps the FS-005A states: **Confirmed** (with source), **Assumed**, **Unknown**.

## 6. BOO Verdict

The FS-005A verdict engine stays deterministic with the same four verdicts. BOO changes the inputs.

| Verdict | BOO rule |
|---|---|
| **At risk** | Critical or high fatal flaw (`no_site`, `no_feedstock`, `no_financing`, `no_offtake`, `unrealistic_permitting`), urgent attention item, or counterparty silence beyond the threshold |
| **Not understood** | Host problem unknown or assumed |
| **Needs attention** | Problem confirmed, but who signs, energy/heat offtake, biochar product offtake, feedstock agreement, site control (land plot), shared utilities, why now or agreed next step is missing |
| **Clear path** | All of the above confirmed |

Weakest-link order for BOO: Host problem → Who signs → Energy and heat offtake → Biochar product offtake → Feedstock agreement → Site control (land plot) → Shared utilities → Why now → Agreed next step → Permitting → Ownership and financing → Public funding → What it is worth. Permitting, investor funding and public funding gate *Clear path* from the **Negotiation** stage onward (decided, section 15). Before that stage they appear as blockers only when nothing earlier is open, and never change the verdict on their own.

### 6.1 BOO impact wording (examples)

- At risk: "We carry the capital, so an unsecured input puts our own money at risk."
- Needs attention: "The plant cannot be financed until feedstock and site are agreed."
- Clear path: "Inputs are secured; the next step is permits and funding."

## 7. Relationship Posture and Eligibility

Amends FS-003 and FS-004. A company is an ecosystem node; roles stay explicit.

1. A BOO deal makes these company types **eligible as counterparty**: Supplier / Vendor, Partner, Customer, Prospect, Offtaker. Never Competitor, Investor, Internal, Consultant, Service Provider, or public bodies as a site owner (Standard Bio leases or owns the site).
2. Eligibility does **not** change the company's type. A supplier stays a supplier.
3. The FS-005A 5.9 posture gate does **not** hide the Brief on a BOO deal.
4. SmartAssist may *suggest* an additional role when the facts support it (for example Offtaker when energy use is on record, or Prospect when a disposal fee is). The user approves; it is never applied automatically.
5. Create Opportunity from a company page still requires a sell-to role. A BOO deal is created from the opportunity workflow with the model chosen explicitly.
6. Unclassified counterparties: show **Classify this relationship** as before.

## 8. BOO Pipeline (FS-022 — no new pipeline)

Build-Own-Operate deals stay in the existing **Project sales** pipeline. No third pipeline, no new stage ids, no change to the kanban. A deal can change model without moving stage.

| Stage | Meaning for a Build-Own-Operate deal |
|---|---|
| Identified | The site, host or supplier is on our radar |
| Qualified | The host problem and the basic fit are confirmed |
| Validation | Feasibility: can feedstock, site and offtake work |
| Proposal | Terms proposed to the counterparties |
| Negotiation | Agreements and financing are being negotiated; **permits and funding gate *Clear path* from here** |
| Won | **Financial close** |

`lost` as in FS-022. Construction and operation are not deal stages; they continue in the Project (FS-015) created from the won deal. Stage moves follow the FS-022 rule that conditions are confirmed only by captured evidence or roster.

## 9. UX Design

- **Header:** the metadata line gains the deal model as one control: "Build-Own-Operate ▾". If unchosen: "Sell the system (assumed) — confirm". No new card, no new tab.
- **Overview:** the FS-005A Deal Brief, with BOO wording. Same three columns, same budget.
- **Understanding:** same unified list; unknowns first, in BOO weakest-link order.
- **Tabs and Actions:** unchanged (four tabs).

## 10. SmartAssist Behaviour

- **Knowledge before questions.** Search correspondence, meetings, documents and SmartDocs for feedstock volumes, gate fees, site facts, permit references and funding discussions before asking.
- **Proposals, not writes.** Anything found is an Assumed proposal until approved.
- **Public funding.** SmartAssist may propose schemes only when they appear in Deep Research, documents or mail. It never names a scheme from memory as a fact.
- **Role suggestions.** As in 7.4.

## 11. Reality First Principle

- A deal model is never chosen for the user. A guess is labelled Assumed.
- No funding scheme, volume, price, permit or role is invented. Unknown stays Unknown.
- Counterparties are never relabelled as customers to make a deal look sellable.

## 12. Persistence / Ownership Rules

- `dealModel` is stored once on the deal (optional field). No second copy of the sales motion.
- Company types, contacts and stakeholders remain in their registries (single source of truth). The BOO deal references them.
- New fields `feedstock_agreement` and `public_funding` use the existing understanding capture storage.

## 13. Acceptance Criteria

- **AC-B1** A user can choose the deal model on an opportunity; the choice persists and overrides the offerings guess.
- **AC-B2** Without a choice the model shows as Assumed and never resolves to BOO by guess.
- **AC-B3** On a BOO deal, Budget and Economic buyer are not asked; feedstock agreement, site control and public funding are.
- **AC-B4** The BOO verdict follows section 6 and always shows an impact line.
- **AC-B5** A Supplier or Partner company on a BOO deal still gets the Brief, and its company type is unchanged.
- **AC-B6** No Create Opportunity action appears for a company that is only a supplier.
- **AC-B7** Switching model keeps all captured answers.
- **AC-B8** Existing deals load without migration and behave as before.
- **AC-B9** No funding scheme is shown unless it has a source.
- **AC-B10** No sales-method or finance jargon appears in the UI.

## 14. Out of Scope

- Financial model, returns, or project-finance structuring.
- Investor or lender CRM (Investor remains a watch/fund role).
- Grant application workflow.
- Any change to the kanban or the stage list; Build-Own-Operate uses Project sales as it is.

## 15. Decisions and Open Questions

Decided (4 Nov 2026):

1. **Funding and permit gates.** They gate *Clear path* from the financing part of the deal onward, not from day one. With one shared pipeline that is the Negotiation stage.
2. **Won stage.** Financial close. Construction and operation continue in the Project (FS-015).
3. **Counterparty types.** Supplier / Vendor, Partner, Customer, Prospect, Offtaker. A municipality or other public body does not count as a site owner, because Standard Bio leases or owns the site.
4. **Multiple counterparties.** One deal; agreements are tracked per counterparty on the stakeholder roster (feedstock, offtake, and any others).
5. **Energy offtake.** One field (`offtake_strategy`), as in section 5. At Antec the surplus energy is sold to a single customer, Vest Biogas. Revisit with its own agreement field only when a second energy customer appears (decided 5 Nov 2026).

## 16. Suggested Delivery Phases

1. **Data and selector. Done (4 Nov 2026).** Optional `dealModel` field, resolution order, header control. No other behaviour change.
2. **BOO profile. Done.** `boo` motion, field wording, two new fields, hidden fields.
3. **BOO verdict. Done.** Engine rules, wording, tests; posture gate removed for BOO. Permit and funding gates apply from the Negotiation stage and at Won (financial close).
4. **Eligibility.** Counterparty eligibility and role suggestions (amends FS-003, FS-004).
5. ~~**BOO pipeline.**~~ Dropped (5 Nov 2026): Build-Own-Operate shares the Project sales pipeline (section 8).
