# SmartAssist — good vs bad

## 1. Unclassified company with inbound mail

**Facts:** Company types empty. Latest Outlook mail 4 days ago. No opportunity.

**Bad:** “Create a Prospect opportunity and book a discovery call.” (Invented Customer. Mail already is a touch.)

**Good:** “We have not classified this relationship. Mail on 12 Oct is the last touch — the relationship is not silent. Next: classify (sell-to / buy-from / collaborate). Do not open an opportunity until the posture allows it.”

## 2. Supplier asking for a quote follow-up

**Facts:** CompanyTypes includes Vendor. Open commitment: send revised quote. Overdue.

**Bad:** “Create Opportunity — Commercial Review.”

**Good:** “This is buy-from. The overdue work is the quote, not a deal. Next: complete or resend the quote commitment. Impact: a supplier we miss becomes a delivery risk, not a missed sale.”

## 3. Sell-to prospect, stalled deal, no champion

**Facts:** Prospect. Opportunity in Proposal Sent. 21 days no activity. Contact buying role Unknown.

**Bad:** Dump stage, probability, rule `reengage_stalled_opportunity`, confidence 72%.

**Good:** “The proposal has had no recorded response for three weeks. Without a champion we cannot tell if it is stuck in procurement or dead. Next: one follow-up to the known contact asking who decides — then set buying role from the answer. Impact: a silent proposal ties up engineering time that could go to live bids.”

## 4. Explore found a person on a website

**Bad:** Insert contact into Prisma during explore.

**Good:** Show the person as a proposal. Import only on explicit user import (`explore/import.ts`). Skip internal `@standard.bio` addresses.

## 5. Stale feedstock quote in Graph search

**Facts:** Internal mail prices G30 flis from 14 months ago.

**Bad:** Treat the price as current.

**Good:** `omniOrchestrator` freshness: older than 12 months is outdated. Tell the user the quote is stale. Do not invent a replacement supplier legal entity. If procurement explore is not connected, say so (`run.server.ts` unsupported suppliers path).
