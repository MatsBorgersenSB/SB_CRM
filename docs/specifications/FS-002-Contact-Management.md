# FS-002 Contact Management

## SmartAssist-First Principle

Contact Management is designed to be AI-assisted by default.

SmartAssist is available throughout the Contact Management experience.

SmartAssist may:

- Suggest existing contacts
- Suggest duplicate contacts
- Suggest contact updates
- Suggest company associations
- Surface relevant Personal Notes before meetings

SmartAssist assists users.

SmartAssist does not make decisions on behalf of users.

All AI-generated actions require user review and approval.

SmartAssist may surface insights and recommendations based on contacts, companies, opportunities, meetings, and historical interactions.

## Status

Review

## Owner

SmartCRM

## Purpose

Create a single source of truth for people and contacts within SmartCRM.

The system must support known, partial, and unknown information while following the Reality First principle.

## Contact Fields

### Core Fields

Contact ID

- First Name
- Last Name
- Full Name
- Job Title
- Email Addresses (0..*)
- Phone Numbers (0..*)
- Preferred Contact Method (Optional)
- LinkedIn URL (Optional)
- Company (optional)
- Business Address (Optional)
- Status
- Personal Notes

## Contact Status

A contact may have one of the following statuses:

- Active
- Archived

## Reality First Principle

SmartCRM shall never invent contact information.

Unknown information shall remain unknown until verified.

Examples:

Allowed:
- Unknown
- Not Provided

Not Allowed:
- Fake names
- Assumed emails
- Invented phone numbers

AI suggestions require user approval.

## Business Goals

### BG-01
Create a single source of truth for contacts.

### BG-02
Reduce duplicate contacts.

### BG-03
Support incomplete and unknown information.

### BG-04
Enable contact reuse across opportunities.

### BG-05
Prepare for Relationship Intelligence.

### BG-06
Prepare for Outlook synchronization.

## User Stories

### US-01
As a salesperson,
I want to create contacts,
so that I can associate them with opportunities.

### US-02
As a salesperson,
I want to search for contacts,
so that I can quickly find stakeholders.

### US-03
As a project manager,
I want to maintain personal notes,
so that relationship knowledge is preserved.

### US-04
As SmartAssist,
I want to suggest existing contacts,
so that duplicate creation is reduced.

## Contact Lifecycle
A contact may be:
- Created manually 
- Created from Outlook import
- Suggested from meeting intelligence
- Suggested by SmartAssist

A contact may be:
- Active
- Archived

Contacts are never permanently deleted if they are linked to opportunities, meetings, or projects.

## Contact Ownership
Each contact may have a designated owner.

The owner is responsible for maintaining:

- Contact information
- Relationship information
- Personal Notes

A contact may have only one owner at a time.

A contact may exist without an owner.

Ownership may be reassigned by authorized users.

## Duplicate Detection
SmartCRM shall detect possible duplicate contacts based on:
- Email Addresses
- Phone Numbers
- Full Name
- Company

Users shall be warned before creating duplicates.

SmartAssist may suggest merging duplicate contacts.Show more lines

## Search
Users shall be able to search contacts by:
- Full Name
- Email Addresses
- Phone Numbers
- Company
- Job Title
- Personal Notes
- LinkedIn URL

Search results should appear instantly.

## Opportunity Integration
Contacts may be assigned as stakeholders to opportunities.
The same contact may participate in multiple opportunities.
A contact shall exist as a single record and be reused across the system.

## SmartAssist Integration
SmartAssist is available throughout the Contact Management experience.

SmartAssist may suggest:
- Existing contacts
- Duplicate contacts
- Contact updates

SmartAssist shall never create contacts automatically.
User approval is required.

## Contact Methods
A contact may have multiple communication methods.

### Email Addresses

A contact may have:
- Work Email
- Personal Email
- Project Email

One email may be marked as Primary.

### Phone Numbers

A contact may have:
- Mobile
- Office
- Home
- WhatsApp

One phone number may be marked as Primary.

## Personal Notes

Personal Notes store relationship knowledge and observations.

Examples:

- Met at IFAT 2026
- Interested in biochar projects
- Prefers phone calls
- Strong sustainability focus

Rules:

- Facts only
- No assumptions
- No invented information
- AI suggestions require approval

## Acceptance Criteria

### AC-01 
User can create contacts.

### AC-02 
User can edit contacts.

### AC-03 
User can archive contacts.

### AC-04 
User can search contacts.

### AC-05 
Duplicate detection works.

### AC-06 
Contacts can be linked to companies.

### AC-07 
Contacts can be linked to opportunities.

### AC-08 
Personal Notes can be stored.

### AC-09 
Personal Notes are searchable.

### AC-10 
Unknown values are supported.

### AC-11 
No fictional contacts are created.

### AC-12 
AI suggestions require user approval. 

### AC-13
A contact may have multiple email addresses.

### AC-14
A contact may have multiple phone numbers.

### AC-15
One email may be marked as primary.

### AC-16
One phone number may be marked as primary.

### AC-17
Each contact may have one designated owner.

### AC-18
Contact ownership can be reassigned by authorized users.

### AC-19
A contact may exist without an owner.

### AC-20
The contact owner is visible in Contact Details.

### AC-21
A contact can be created with partial information.

### AC-22
Contacts linked to opportunities cannot be permanently deleted.


## Out of Scope

The following capabilities are addressed in future feature specifications:

- Company Management
- Relationship Intelligence
- Outlook Synchronization
- Contact Scoring
- Contact Tags
