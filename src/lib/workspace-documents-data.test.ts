import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { workspaceDocumentsHref } from "../types/relationship-navigation";
import {
  buildAllWorkspaceDocumentRows,
  workspaceDocumentsContextFromProject,
  WORKSPACE_PROJECT_DOCUMENT_PRESETS,
  workspaceDocumentsLinkSummary,
} from "./workspace-documents-data";
import {
  buildWorkspaceDocumentFilterDefinitions,
  filterWorkspaceDocumentRows,
} from "./workspace-documents-table";
import { computeDocumentIntelligence } from "./document-intelligence-engine";
import { buildDocument360Snapshot } from "./document-360-data";
import { smartDocFromLibraryRecord } from "../types/smartdoc";
import { SMARTDOC_TYPES, type SmartDocLibraryRecord } from "../types/smartdoc-library";
import type { Company } from "../types/company";
import type { PipelineRow } from "../types/pipeline";
import type { Project } from "../types/project";

const escalante = {
  id: "PRJ-CARBON-EMERGENTE",
  name: "Escalante",
  linkedDealId: "PL-1031",
  linkedCompanyId: "CO-CARBON",
} as Project;

describe("project documents stay on the project", () => {
  it("Documents on a project workspace does not follow a missing linked deal", () => {
    const href = workspaceDocumentsHref({
      projectId: "PRJ-CARBON-EMERGENTE",
      dealId: "PL-1031",
    });
    assert.equal(
      href,
      "/projects/PRJ-CARBON-EMERGENTE?view=actions&action=documents",
    );
  });

  it("does not put a ghost linkedDealId into the documents context", () => {
    const context = workspaceDocumentsContextFromProject(escalante);
    assert.equal(context.scope, "project");
    assert.equal(context.projectId, "PRJ-CARBON-EMERGENTE");
    assert.equal(context.dealId, undefined);
    assert.deepEqual(context.pipelineIds, []);
  });

  it("keeps a live linked opportunity on the context when the pipeline exists", () => {
    const pipeline = {
      id: "live-deal",
      assetName: "Escalante expansion",
    } as PipelineRow;
    const context = workspaceDocumentsContextFromProject(escalante, pipeline);
    assert.equal(context.dealId, "live-deal");
    assert.deepEqual(context.pipelineIds, ["live-deal"]);
  });

  it("offers project Create shortcuts from the SharePoint list, not deal quotations", () => {
    const labels = WORKSPACE_PROJECT_DOCUMENT_PRESETS.map((row) => row.label);
    assert.deepEqual(labels, [
      "Minutes of meeting",
      "Project plan",
      "Change request",
      "Issue log",
      "Drawing",
      "Procedure",
      "Certificate",
      "Report",
    ]);
    for (const row of WORKSPACE_PROJECT_DOCUMENT_PRESETS) {
      assert.ok(
        (SMARTDOC_TYPES as readonly string[]).includes(row.type),
        `${row.type} is not in the SharePoint type list`,
      );
    }
    assert.ok(!labels.some((label) => /quotation|rfq|presentation/i.test(label)));
  });

  it("shows the real SharePoint path instead of /Projects/{Name}", () => {
    const context = workspaceDocumentsContextFromProject(escalante, undefined, {
      CompanyID: "CO-CARBON",
      Title: "Carbón Emergente",
    } as never);
    assert.match(
      workspaceDocumentsLinkSummary(context),
      /\/Projects\/Carbón Emergente\/Escalante/,
    );
  });

  it("assigns statusKind='project' to project-owned SmartDocs and exposes 'On a project' filter", () => {
    const projectDoc: SmartDocLibraryRecord = {
      id: 1,
      SmartDocID: "PRJ-CARBON-EMERGENTE-E-DRW-0001",
      DealId: null,
      Ownership: "project",
      LinkedProjectId: "PRJ-CARBON-EMERGENTE",
      PlNumber: "PRJ-CARBON-EMERGENTE",
      ClientName: "Carbón Emergente",
      DealName: "Escalante",
      CommercialStage: "Commissioning",
      CreatedAt: "2026-10-01T10:00:00.000Z",
      DocCategory: "Engineering",
      DocType: "Drawing",
      DocumentName: "P&ID Layout",
      Revision: "01",
      FileLeafRef: "pid.pdf",
    };

    const rows = buildAllWorkspaceDocumentRows([projectDoc], [], []);
    assert.equal(rows[0]?.statusKind, "project");

    const defs = buildWorkspaceDocumentFilterDefinitions(rows);
    const statusDef = defs.find((d) => d.id === "status");
    assert.ok(statusDef?.options.some((opt) => opt.value === "project" && opt.label === "On a project"));

    const filtered = filterWorkspaceDocumentRows(rows, {
      search: "",
      filters: { status: "project" },
    });
    assert.equal(filtered.length, 1);
  });

  it("resolves company ownership, AccountOwner, and Reality First permit intelligence for company-owned SmartDocs", () => {
    const company = {
      id: 1,
      CompanyID: "CO-1009",
      Title: "Vest Biogass AS",
      Industry: "Biogas",
      Status: "Active",
      AccountOwner: { Id: 1, Title: "Mats" },
      contacts: [],
      pipelineIds: [],
    } as unknown as Company;
    const permitRecord: SmartDocLibraryRecord = {
      id: 2,
      SmartDocID: "CO-1009-Q-CER-0001",
      DealId: null,
      OwnerCompanyId: "CO-1009",
      Ownership: "company",
      PlNumber: "CO-1009",
      ClientName: "Vest Biogass AS",
      DealName: "Vest Biogass AS",
      CommercialStage: "Company",
      CreatedAt: "2026-10-15T10:00:00.000Z",
      DocCategory: "Quality",
      DocType: "Certificate",
      DocumentName: "Utslippstillatelse Statsforvalteren",
      Revision: "01",
      FileLeafRef: "tillatelse.pdf",
      Origin: "external",
    };

    const doc = smartDocFromLibraryRecord(permitRecord);
    const intel = computeDocumentIntelligence(doc, [], [company], []);
    assert.equal(intel.ownerLabel, "Mats");
    assert.equal(intel.approvalStatus, "Approved");
    assert.ok(!intel.risks.some((r) => r.type === "missing_owner"));
    assert.ok(!intel.risks.some((r) => r.type === "expiring_certificate"));

    const snapshot = buildDocument360Snapshot(doc, [], [company], [], [permitRecord], []);
    assert.equal(snapshot.businessContext.ownershipKind, "company");
    assert.equal(snapshot.businessContext.clientName, "Vest Biogass AS");
    assert.equal(snapshot.businessContext.originLabel, "External");
  });
});
