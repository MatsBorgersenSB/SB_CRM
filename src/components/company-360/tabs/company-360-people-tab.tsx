import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { CreateContactInput, EditableContactField } from "@/types/contact";
import { Company360ActivitiesTab } from "@/components/company-360/tabs/company-360-activities-tab";
import { Company360ContactsTab } from "@/components/company-360/tabs/company-360-contacts-tab";

export function Company360PeopleTab({
  company,
  activities,
  onCreateContact,
  onContactFieldCommit,
}: {
  company: Company;
  activities: Activity[];
  onCreateContact: (input: CreateContactInput) => Promise<void>;
  onContactFieldCommit: (
    contactId: string,
    field: EditableContactField,
    value: string,
  ) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Company360ContactsTab
        company={company}
        activities={activities}
        onCreateContact={onCreateContact}
        onContactFieldCommit={onContactFieldCommit}
      />
      <Company360ActivitiesTab activities={activities} />
    </div>
  );
}
