/** Pluggable token provider for Microsoft Graph (MSAL / managed identity / on-behalf-of). */
export interface IGraphTokenProvider {
  getAccessToken(): Promise<string>;
}

export class StaticTokenProvider implements IGraphTokenProvider {
  constructor(private readonly token: string) {}

  async getAccessToken(): Promise<string> {
    if (!this.token) {
      throw new Error("Graph access token is not configured");
    }
    return this.token;
  }
}

export class EnvTokenProvider implements IGraphTokenProvider {
  async getAccessToken(): Promise<string> {
    const token = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN;
    if (!token) {
      throw new Error(
        "MICROSOFT_GRAPH_ACCESS_TOKEN is required for Graph transport",
      );
    }
    return token;
  }
}
