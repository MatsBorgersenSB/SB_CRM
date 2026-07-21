
[+] Added Schemas
  - public

[+] Added enums
  - CompanyStatus
  - CompanySize
  - CompanyType
  - ContactStatus
  - RelationshipStatus
  - RelationshipType
  - OpportunityStatus
  - OpportunityStage
  - InfluenceLevel
  - SentimentStance
  - AuthorityClass
  - VerificationState

[+] Added tables
  - company_registry
  - company_notes
  - contact_registry
  - relationship_registry
  - relationship_interactions
  - opportunity_registry
  - opportunity_insights
  - stakeholder_influence_profiles
  - decision_maker_profiles

[*] Changed the `company_notes` table
  [+] Added foreign key on columns (companyId)

[*] Changed the `company_registry` table
  [+] Added unique index on columns (organizationNumber)
  [+] Added index on columns (name)
  [+] Added index on columns (organizationNumber)
  [+] Added foreign key on columns (parentCompanyId)

[*] Changed the `contact_registry` table
  [+] Added index on columns (fullName)
  [+] Added index on columns (companyId)
  [+] Added foreign key on columns (companyId)

[*] Changed the `decision_maker_profiles` table
  [+] Added unique index on columns (opportunityId, contactId, authorityClass)
  [+] Added foreign key on columns (opportunityId)
  [+] Added foreign key on columns (contactId)

[*] Changed the `opportunity_insights` table
  [+] Added foreign key on columns (opportunityId)

[*] Changed the `opportunity_registry` table
  [+] Added index on columns (companyId)
  [+] Added index on columns (ownerId)
  [+] Added index on columns (stage)
  [+] Added foreign key on columns (companyId)

[*] Changed the `relationship_interactions` table
  [+] Added foreign key on columns (relationshipId)

[*] Changed the `relationship_registry` table
  [+] Added unique index on columns (sourceContactId, targetContactId, relationshipType)
  [+] Added foreign key on columns (sourceContactId)
  [+] Added foreign key on columns (targetContactId)

[*] Changed the `stakeholder_influence_profiles` table
  [+] Added unique index on columns (opportunityId, contactId)
  [+] Added foreign key on columns (opportunityId)
  [+] Added foreign key on columns (contactId)
