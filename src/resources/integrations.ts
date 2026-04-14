import { buildQuery, type HttpClient } from "../client.js";
import type {
  CompleteConnectionInput,
  DataSourceConnection,
  IntegrationSetting,
  ListConnectionsParams,
  RequestOptions,
  StartConnectionInput,
  StartConnectionResult,
} from "../types.js";

export class Integrations {
  constructor(private readonly http: HttpClient) {}

  async listProviders(opts?: RequestOptions): Promise<IntegrationSetting[]> {
    return this.http.get<IntegrationSetting[]>("/integrations/list", opts);
  }

  async listConnections(
    params: ListConnectionsParams,
    opts?: RequestOptions,
  ): Promise<DataSourceConnection[]> {
    const query = buildQuery(params);
    return this.http.get<DataSourceConnection[]>(`/integrations/connections${query}`, opts);
  }

  async getConnection(id: string, opts?: RequestOptions): Promise<DataSourceConnection> {
    return this.http.get<DataSourceConnection>(`/integrations/connections/${id}`, opts);
  }

  async startConnection(
    input: StartConnectionInput,
    opts?: RequestOptions,
  ): Promise<StartConnectionResult> {
    return this.http.post<StartConnectionResult>("/integrations/connections/start", input, opts);
  }

  async completeConnection(
    input: CompleteConnectionInput,
    opts?: RequestOptions,
  ): Promise<DataSourceConnection> {
    return this.http.post<DataSourceConnection>(
      "/integrations/connections/complete",
      input,
      opts,
    );
  }

  async deleteConnection(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete(`/integrations/connections/${id}`, opts);
  }
}
