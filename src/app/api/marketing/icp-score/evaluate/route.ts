import { NextResponse } from "next/server";
import {
  calculateICPScore,
  companyToICPInput,
  type ICPCompanyInput,
} from "@/lib/marketing/icp-matcher";
import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { mapPrismaCompanyToApp } from "@/lib/prisma-mappers";

type EvaluateBody = {
  companyId?: string;
  companyData?: ICPCompanyInput;
};

/**
 * POST /api/marketing/icp-score/evaluate
 * Body: { companyId? } or { companyData }
 */
export async function POST(request: Request) {
  let body: EvaluateBody;
  try {
    body = (await request.json()) as EvaluateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    if (body.companyData) {
      const result = calculateICPScore(body.companyData);
      return NextResponse.json({
        companyName: body.companyData.Title ?? null,
        ...result,
      });
    }

    const companyId = body.companyId?.trim();
    if (!companyId) {
      return NextResponse.json(
        { error: "companyId or companyData is required" },
        { status: 400 },
      );
    }

    const prismaCompany = await findPrismaCompanyByRouteKey(companyId);
    if (!prismaCompany) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const company = mapPrismaCompanyToApp(prismaCompany);
    const result = calculateICPScore(
      companyToICPInput({ ...company, size: prismaCompany.size }),
    );

    return NextResponse.json({
      companyId: company.code || company.CompanyID,
      companyName: company.Title,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to evaluate ICP";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
