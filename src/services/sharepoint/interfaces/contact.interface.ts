import type { Contact, CreateContactInput, UpdateContactInput } from "@/types/contact";
import type { ISharePointEntityService } from "@/services/sharepoint/interfaces/common.interface";

export interface IContactsService
  extends ISharePointEntityService<
    Contact,
    CreateContactInput,
    UpdateContactInput
  > {}
