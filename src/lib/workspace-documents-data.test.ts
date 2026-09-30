import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { workspaceDocumentsHref } from "../types/relationship-navigation";
import { workspaceDocumentsContextFromProject } from "./workspace-documents-data";
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
});
