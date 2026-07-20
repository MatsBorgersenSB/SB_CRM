import type { CommercialPackage } from "@/types/commercial-package";

export type CreateCommercialPackageInput = Omit<
  CommercialPackage,
  "id" | "PackageID" | "DocumentSetID"
> & {
  PackageID?: string;
  DocumentSetID?: string;
};

export type UpdateCommercialPackageInput = Partial<
  Omit<CommercialPackage, "id" | "PackageID">
>;

export type SendQuotationInput = {
  quotationPackageId: string;
  recipient: string;
};

export type AcceptTransmissionInput = {
  transmissionPackageId?: string;
};
