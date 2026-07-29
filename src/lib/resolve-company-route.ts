/**
 * Company route resolution — re-exports the flexible entity resolver.
 * Implementation lives in `@/lib/data/companies` (id OR code / CompanyID).
 */

export {
  findCompanyInPortfolio,
  findPrismaCompanyByRouteKey,
  getCompany,
  getCompanyById,
  resolveCompanyRouteRecord,
} from "@/lib/data/companies";
