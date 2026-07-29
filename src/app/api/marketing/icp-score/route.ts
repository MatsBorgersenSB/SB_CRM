import { NextResponse } from "next/server";
import {
  calculateICPScore,
  companyToICPInput,
  type ICPCompanyInput,
} from "@/lib/marketing/icp-matcher";
import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { mapPrismaCompanyToApp } from "@/lib/prisma-mappers";

/**
 * GET /api/marketing/icp-score?companyId=CO-1001
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId")?.trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const prismaCompany = await findPrismaCompanyByRouteKey(companyId);
    if (!prismaCompany) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const company = mapPrismaCompanyToApp(prismaCompany);
    const input = companyToICPInput({
      ...company,
      size: prismaCompany.size,
    });
    const result = calculateICPScore(input);

    return NextResponse.json({
      companyId: company.code || company.CompanyID,
      companyName: company.Title,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to score ICP";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
