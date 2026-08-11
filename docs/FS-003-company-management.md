# FS-003 Company Management

## Document Information

| Property | Value |
|-----------|-----------|
| Specification ID | FS-003 |
| Name | Company Management |
| Status | Approval Review |
| Owner | SmartCRM |
| Category | Core Capability |

## SmartAssist-First Principle

Company Management is designed to be AI-assisted by default.

SmartAssist is available throughout the Company Management experience.

SmartAssist assists users.

SmartAssist does not make decisions on behalf of users.

All AI-generated actions require user review and approval.

## Purpose

Create a single source of truth for organizations and companies within SmartCRM.

A company serves as the primary business entity to which contacts, opportunities, projects, activities, and future relationship intelligence can be connected.

The system must support known, partial, and unknown information while following the Reality First principle.

---
## Company Hierarchy

A company may have:

- One Parent Company
- Zero or More Child Companies

Companies may exist independently without a parent company.

---

## Company Fields

### Core Fields

- Company ID
- Company Name
- Alternative Names (0..*)
- Parent Company (Optional)
- Organization Number
- VAT Number
- Website (optional)
- Industry (optional)
- Company Size
- Company Types (0..*)
- Email Addresses (0..*)
- Phone Numbers (0..*)
- Status
- Company Notes

### Address Fields

- Address Line 1
- Address Line 2
- Postal Code
- City
- State / Region
- Country

---
### Company Size

A company may have:

- Micro (1-9 employees)
- Small (10-49 employees)
- Medium (50-249 employees)
- Large (250+ employees)
- Unknown

---
### Company Types

A company may have one or more Company Types. A company is an **ecosystem node**, not automatically a client.

**Selectable roles**

- Prospect
- Customer
- Partner
- Competitor
- Supplier / Vendor
- Consultant
- Public / Government
- University / Research
- Investor
- NGO / Non-Profit
- Granting Authority

**System default when role is unknown**

- Unclassified (Reality First — never invent Customer)

**Relationship posture (drives SmartAssist)**

| Posture | Types | Opportunity CTAs |
|---------|-------|------------------|
| Sell to | Customer, Prospect, Offtaker | Allowed when justified |
| Buy from | Supplier / Vendor, Consultant, Service Provider | Never invent |
| Collaborate | Partner, University, Public, NGO, … | Only if also sell-to |
| Watch / fund / internal | Competitor, Investor, Internal | Never invent |
| Unclassified | Missing role | Classify first — never Create Opportunity |

See `.cursor/rules/smartcrm-north-star.mdc` (Relationship posture) and `src/lib/company-classification.ts`.

---

## Company Status

A company may have one of the following statuses:

- Active
- Archived

---

## Reality First Principle

SmartCRM shall never invent company information.

Unknown information shall remain unknown until verified.

Examples:

### Allowed

- Unknown
- Not Provided

### Not Allowed

- Invented company names
- Invented organization numbers
- Invented websites
- Invented addresses
- Invented company sizes

AI suggestions require user approval.

---

## Business Goals

### BG-01

Create a single source of truth for companies.

### BG-02

Reduce duplicate company records.

### BG-03

Enable company reuse across opportunities.

### BG-04

Enable company reuse across contacts.

### BG-05

Prepare for Relationship Intelligence.

### BG-06

Prepare for Organization Intelligence.

### BG-07

Prepare for Outlook synchronization.

---

## User Stories

### US-01

As a salesperson,

I want to create companies,

so that contacts and opportunities can be associated with them.

### US-02

As a salesperson,

I want to search companies,

so that I can quickly find customers and prospects.

### US-03

As a project manager,

I want to see all contacts associated with a company,

so that I understand the organization.

### US-04

As SmartAssist,

I want to suggest existing companies,

so that duplicate records are reduced.

---

## Company Lifecycle

A company may be:

- Created manually
- Imported from external systems
- Suggested by SmartAssist

A company may be:

- Active
- Archived

Companies are never permanently deleted if they are linked to contacts, opportunities, projects, meetings, or activities.

---

# Company Registry

## Company Registry Principle

The Company Registry is the single source of truth for Company records across SmartCRM.

All platform capabilities shall derive Company information from the Company Registry.

Future SmartCRM capabilities shall reuse Company data from the Company Registry.

Independent Company stores are prohibited.

Examples of prohibited patterns:

- Opportunity-specific Company stores
- Contact-specific Company stores
- Meeting-specific Company stores
- Workspace-specific Company stores
- Intelligence-specific Company stores

The Company Registry remains authoritative for all Company Facts.

---

# Company Model

## Company Entity

```ts
interface Company {
  id: string;

  name: string;

  alternativeNames?: string[];

  organizationNumber?: string;

  vatNumber?: string;

  website?: string;

  industry?: string;

  size?: CompanySize;

  types?: CompanyType[];

  status: CompanyStatus;

  ownerId?: string;

  parentCompanyId?: string;

  notes?: string;

  createdAt: string;

  updatedAt: string;
}
```

The Company record remains the system of record for Company information.

---

## Company Facts Principle

Company Facts represent verified business information.

Examples include:

- Company Name
- Organization Number
- VAT Number
- Website
- Industry
- Company Size
- Company Type
- Parent Company
- Status

Company Facts originate from the Company Registry.

Company Facts remain authoritative until modified by authorized users.

---

## Company Intelligence Separation Principle

Company Intelligence represents advisory information generated by SmartAssist.

Examples include:

- Duplicate Detection Suggestions
- Company Enrichment Suggestions
- Missing Information Suggestions
- Company Health Indicators
- Relationship Coverage Indicators
- Organization Intelligence

Company Intelligence is advisory.

Company Intelligence is not system-of-record data.

Company Intelligence shall remain distinguishable from Company Facts.

Company Intelligence shall never automatically modify Company records.

Unknown remains preferred over fiction.

---

# Functional Requirements

## FR-001 Create Company

The system shall allow authorized users to create Company records.

Requirements:

- Company creation shall be auditable.
- Companies may be created with partial information.
- Unknown values shall be supported.
- SmartAssist shall not automatically create Company records.

---

## FR-002 View Company

The system shall allow authorized users to view Company information.

Displayed information shall include:

- Company Name
- Company Status
- Company Type
- Owner
- Parent Company
- Contact Count
- Opportunity Count

---

## FR-003 Update Company

The system shall allow authorized users to modify Company records.

Requirements:

- Changes shall be auditable.
- Historical data shall be preserved where appropriate.
- SmartAssist shall not automatically modify Company records.

---

## FR-004 Company Ownership

The system shall support Company ownership.

Requirements:

- Ownership is optional.
- Ownership changes must be auditable.
- Ownership changes shall not automatically modify Contact Ownership.
- Ownership changes shall not automatically modify Opportunity Ownership.

---

## FR-005 Company Registry

The Company Registry shall be the single source of truth for Company information.

Requirements:

- Future capabilities shall reuse the Company Registry.
- Duplicate Company stores are prohibited.
- Platform capabilities shall reference Company records rather than duplicate them.

---

# Permissions (RBAC)

## View Permissions

Authorized users may:

- View Companies
- View Company Contacts
- View Company Opportunities
- View Company Intelligence

subject to granted permissions.

---

## Edit Permissions

Authorized users may:

- Create Companies
- Update Companies
- Archive Companies
- Assign Company Owners

subject to granted permissions.

---

## Administrative Permissions

Administrators may:

- Restore Archived Companies
- Access Audit History
- Review Ownership Changes
- Review Historical Company Data

subject to SmartCRM RBAC policies.

---

## SmartAssist Permissions

SmartAssist shall never:

- Create Companies automatically
- Modify Company records automatically
- Archive Companies automatically
- Assign Owners automatically

User approval is always required.

---

# Auditability

## Company Auditability

The platform shall maintain audit history for:

- Company Creation
- Company Updates
- Ownership Changes
- Status Changes
- Parent Company Changes

Audit history shall include:

- User
- Timestamp
- Previous Value
- New Value

Audit information shall remain available to authorized users.

---

# Future Platform Dependency

## Planned Consumers

Future capabilities may consume Company information through the Company Registry.

Examples:

- FS-004 Relationship Intelligence
- FS-005 Opportunity Workspace
- FS-006 Influence Mapping
- FS-007 Decision Maker Intelligence
- FS-008 Meeting Intelligence
- FS-009 Email Intelligence
- FS-010 Contact Intelligence

Future capabilities shall reuse Company data rather than create duplicate Company stores.

---

## Single Source of Truth

The Company Registry shall remain the authoritative source of Company information across SmartCRM.

Future platform capabilities shall extend and consume Company information through the Company Registry rather than maintain independent Company stores.

Platform reuse is mandatory.

Duplicate Company ownership boundaries are prohibited.

---

## Company Ownership

Each company may have a designated owner.

The owner is responsible for maintaining:

- Company information
- Business relationships
- Company Notes

A company may have only one owner at a time.

A company may exist without an owner.

Ownership may be reassigned by authorized users.

---

## Duplicate Detection

SmartCRM shall detect possible duplicate companies based on:

- Company Name
- Organization Number
- VAT Number
- Website
- Email Addresses (0..*)
- Phone Numbers (0..*)

Users shall be warned before creating duplicate companies.

SmartAssist may suggest duplicate companies for review.

---

## Search

Users shall be able to search companies by:

- Company Name
- Organization Number
- Alternative Names
- Website
- Email
- Phone Number
- City
- Country
- Industry
- Company Notes

Search results should appear instantly.

---

## Contact Integration

A company may have multiple contacts.

A contact may belong to one primary company.

Company records shall display:

- Associated Contacts
- Contact Count
- Key Stakeholders

Changes made to a company shall immediately be reflected across all related contacts.

---

## Opportunity Integration

A company may have multiple opportunities.

Company records shall display:

- Open Opportunities
- Closed Opportunities
- Opportunity Value
- Opportunity History

Changes made to a company shall immediately be reflected across all related opportunities.

---

## SmartAssist Integration

SmartAssist may suggest:

- Existing companies
- Duplicate companies
- Company information updates
- Missing company information

SmartAssist shall never create companies automatically.

User approval is required.

SmartAssist is available throughout the Company Management experience.

SmartAssist may:

- Suggest company matches
- Suggest duplicate detection
- Suggest data improvements
- Suggest hierarchy relationships
- Suggest missing information
- Surface relevant insights

SmartAssist shall never make changes without user approval.

---

## Notes

Company Notes store business context and verified observations.

Examples:

- Interested in biochar projects.
- Expansion planned for 2027.
- Looking into carbon removal solutions.
- Existing supplier relationship.

Rules:

- Facts only
- No assumptions
- No invented information
- AI suggestions require approval

---

## Acceptance Criteria

### AC-01

User can create companies.

### AC-02

User can edit companies.

### AC-03

User can archive companies.

### AC-04

User can search companies.

### AC-05

Duplicate detection works.

### AC-06

Companies can be linked to contacts.

### AC-07

Companies can be linked to opportunities.

### AC-08

Company Notes can be stored.

### AC-09

Company Notes are searchable.

### AC-10

Unknown values are supported.

### AC-11

No fictional company data is created.

### AC-12

AI suggestions require user approval.

### AC-13

Each company may have one designated owner.

### AC-14

Company ownership can be reassigned by authorized users.

### AC-15

A company may exist without an owner.

### AC-16

The company owner is visible in Company Details.

### AC-17

A company can be created with partial information.

### AC-18

A company may have multiple contacts.

### AC-19

A company may have multiple opportunities.

### AC-20

Companies linked to contacts, opportunities, projects, meetings, or activities cannot be permanently deleted.

### AC-21

A company may have one or more Company Types.

### AC-22

Company Notes are visible in Company Details.

### AC-23

A company may contain unknown values without requiring placeholder information.

### AC-24

A company may have one parent company.

### AC-25

A company may have multiple child companies.

### AC-26

Users can view company hierarchy from Company Details.

### AC-27

Companies can exist without a parent company.

### AC-28

A company may store one or more alternative names.

### AC-29

Alternative names are searchable.

### AC-30

Users can search for parent and child companies.

---

## Out of Scope

The following capabilities are addressed in future feature specifications:

- Relationship Intelligence
- Organization Charts
- Influence Mapping
- Contact Scoring
- Company Scoring
- Outlook Synchronization
- Knowledge Graph
- AI Relationship Discovery