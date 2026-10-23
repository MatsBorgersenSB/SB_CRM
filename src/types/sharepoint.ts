/**
 * SharePoint list field shapes shared by companies and contacts.
 * Kept in its own module so those two type files do not import each other.
 */

export type SharePointLookup = {
  Id: number;
  Title: string;
};

export type SharePointPerson = {
  Id: number;
  Title: string;
};
