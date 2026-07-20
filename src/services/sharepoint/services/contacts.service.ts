import type { IContactsService } from "@/services/sharepoint/interfaces/contact.interface";
import { BaseSharePointEntityService } from "@/services/sharepoint/services/base-entity.service";
import type { IListRepository } from "@/services/sharepoint/client/types";
import type { Contact, CreateContactInput, UpdateContactInput } from "@/types/contact";

export class ContactsService
  extends BaseSharePointEntityService<
    Contact,
    CreateContactInput,
    UpdateContactInput
  >
  implements IContactsService
{
  constructor(
    repository: IListRepository<Contact, CreateContactInput, UpdateContactInput>,
  ) {
    super(repository, undefined, "Contacts");
  }
}
