import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { workspaceDocumentsHref } from "../types/relationship-navigation";
import { workspaceDocumentsContextFromProject, WORKSPACE_PROJECT_DOCUMENT_PRESETS, workspaceDocumentsLinkSummary } from "./workspace-documents-data";
import { SMARTDOC_TYPES } from "../types/smartdoc-library";
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
});
