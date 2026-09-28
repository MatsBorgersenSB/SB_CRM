import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canUploadSmartDocs } from "@/lib/permissions";
import { companyHasType } from "@/lib/company-classification";
import { companyWebsiteHref } from "@/lib/company-identity";
import {
  competitorBriefTitle,
  extractCompetitorBriefClaims,
  findCompetitorDealOverlap,
} from "@/lib/competitor-brief";
import {
  createSourceFinding,
  isPublicHttpUrl,
} from "@/lib/source-findings";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";

const FETCH_MS = 8000;
const MAX_BYTES = 750_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const role = await resolveRequestRole(request);
  if (!canUploadSmartDocs(role) && role !== "admin") {
    return NextResponse.json(
      { error: "You cannot collect competitor knowledge with this role" },
      { status: 403 },
    );
  }

  try {
    const { companies, deals } = getServerSharePointServices();
    const company = await companies.getById(companyId);

    if (!companyHasType(company, "Competitor")) {
      return NextResponse.json(
        {
          error:
            "Collect competitor knowledge is only for companies classified as Competitor.",
        },
        { status: 400 },
      );
    }

    let overlap: ReturnType<typeof findCompetitorDealOverlap> = [];
    try {
      const listed = await deals.list({ pageSize: 400 });
      overlap = findCompetitorDealOverlap(listed.items, company);
    } catch (error) {
      console.warn(
        "[competitor-brief] deal overlap skipped:",
        error instanceof Error ? error.message : error,
      );
    }

    const website = company.Domain ? companyWebsiteHref(company.Domain) : "";
    const sourceUrl = isPublicHttpUrl(website) ? website : undefined;
    let html = "";
    let host: string | undefined;

    if (sourceUrl) {
      try {
        const page = await fetch(sourceUrl, {
          redirect: "follow",
          signal: AbortSignal.timeout(FETCH_MS),
          headers: {
            Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
            "User-Agent": "SmartCRM-competitor-brief/1.0",
          },
        });
        if (page.ok) {
          const buffer = await page.arrayBuffer();
          const bytes = buffer.byteLength > MAX_BYTES ? buffer.slice(0, MAX_BYTES) : buffer;
          html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
          host = new URL(sourceUrl).hostname.replace(/^www\./, "");
        }
      } catch (error) {
        console.warn(
          "[competitor-brief] website read failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    const claims = extractCompetitorBriefClaims({
      companyName: company.Title,
      htmlOrText: html,
      sourceUrl,
      overlap,
    });

    const finding = createSourceFinding({
      title: competitorBriefTitle(company.Title, host),
      url: sourceUrl,
      kind: "competitor",
      claims,
    });

    return NextResponse.json({ finding });
  } catch (error) {
    if (error instanceof SharePointServiceError && error.statusCode === 404) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    console.warn(
      "[competitor-brief] failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Could not collect competitor knowledge" },
      { status: 500 },
    );
  }
}
