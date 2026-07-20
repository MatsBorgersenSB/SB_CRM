export type SharePointTransport = "graph" | "local";

export type SharePointEnvironment = {
  transport: SharePointTransport;
  siteId: string;
  tenantId: string;
  graphBaseUrl: string;
};

function readTransport(): SharePointTransport {
  const value = process.env.SHAREPOINT_TRANSPORT?.toLowerCase();
  return value === "graph" ? "graph" : "local";
}

export function getSharePointEnvironment(): SharePointEnvironment {
  return {
    transport: readTransport(),
    siteId: process.env.SHAREPOINT_SITE_ID ?? "",
    tenantId: process.env.AZURE_TENANT_ID ?? "",
    graphBaseUrl:
      process.env.MICROSOFT_GRAPH_BASE_URL ?? "https://graph.microsoft.com/v1.0",
  };
}

export function isGraphTransport(): boolean {
  return getSharePointEnvironment().transport === "graph";
}
