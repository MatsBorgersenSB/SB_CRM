import type { CommercialPackage } from "@/types/commercial-package";
import type { CreateCommercialPackageInput } from "@/types/commercial-package-input";
import type { GraphListItem, ListItemMapper } from "@/services/sharepoint/client/types";
import type { DocumentSetMember } from "@/types/commercial-package";

type CommercialPackageFields = {
  PackageID: string;
  DocumentSetID?: string;
  DealId: string;
  Kind: string;
  Status: string;
  Title: string;
  ParentPackageId?: string;
  Recipient?: string;
  SentAt?: string;
  AcceptedAt?: string;
  MembersJson: string;
  Summary?: string;
};

function parseMembers(value: string | undefined): DocumentSetMember[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as DocumentSetMember[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifyMembers(members: DocumentSetMember[] | undefined): string {
  return JSON.stringify(members ?? []);
}

export const commercialPackageMapper: ListItemMapper<
  CommercialPackageFields,
  CommercialPackage
> = {
  toDomain(item: GraphListItem<CommercialPackageFields>): CommercialPackage {
    const fields = item.fields;
    return {
      id: Number(item.id),
      PackageID: fields.PackageID,
      DocumentSetID: fields.DocumentSetID ?? fields.PackageID,
      DealId: fields.DealId,
      kind: fields.Kind as CommercialPackage["kind"],
      status: fields.Status as CommercialPackage["status"],
      title: fields.Title ?? "",
      parentPackageId: fields.ParentPackageId,
      recipient: fields.Recipient,
      sentAt: fields.SentAt,
      acceptedAt: fields.AcceptedAt,
      members: parseMembers(fields.MembersJson),
      summary: fields.Summary,
    };
  },

  toFields(
    input: Partial<CommercialPackage> | CreateCommercialPackageInput,
  ): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    const row = input as Partial<CommercialPackage>;

    if (row.PackageID !== undefined) fields.PackageID = row.PackageID;
    if (row.DocumentSetID !== undefined) fields.DocumentSetID = row.DocumentSetID;
    if (row.DealId !== undefined) fields.DealId = row.DealId;
    if (row.kind !== undefined) fields.Kind = row.kind;
    if (row.status !== undefined) fields.Status = row.status;
    if (row.title !== undefined) fields.Title = row.title;
    if (row.parentPackageId !== undefined) fields.ParentPackageId = row.parentPackageId;
    if (row.recipient !== undefined) fields.Recipient = row.recipient;
    if (row.sentAt !== undefined) fields.SentAt = row.sentAt;
    if (row.acceptedAt !== undefined) fields.AcceptedAt = row.acceptedAt;
    if (row.members !== undefined) fields.MembersJson = stringifyMembers(row.members);
    if (row.summary !== undefined) fields.Summary = row.summary;

    return fields;
  },
};
