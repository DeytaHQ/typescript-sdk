import { buildQuery, type HttpClient } from "../client.js";
import type {
  CompleteConnectionInput,
  DataSourceConnection,
  IntegrationSetting,
  ListConnectionsParams,
  RequestOptions,
  StartConnectionInput,
  StartConnectionResult,
  Target,
} from "../types.js";

/**
 * Flatten a `Target` into the `target_type` / `target_id` /
 * `target_external_reference_id` query-string shape the gateway expects on
 * `GET /integrations/connections`.
 */
function targetToQuery(target: Target): Record<string, string | undefined> {
  return {
    target_type: target.type,
    target_id: "id" in target ? target.id : undefined,
    target_external_reference_id:
      "external_reference_id" in target ? target.external_reference_id : undefined,
  };
}

export class Integrations {
  constructor(private readonly http: HttpClient) {}

  async listProviders(opts?: RequestOptions): Promise<IntegrationSetting[]> {
    return this.http.get<IntegrationSetting[]>("/integrations/list", opts);
  }

  async listConnections(
    target: ListConnectionsParams,
    opts?: RequestOptions,
  ): Promise<DataSourceConnection[]> {
    const query = buildQuery(targetToQuery(target));
    return this.http.get<DataSourceConnection[]>(
      `/integrations/connections${query}`,
      opts,
    );
  }

  async getConnection(id: string, opts?: RequestOptions): Promise<DataSourceConnection> {
    return this.http.get<DataSourceConnection>(`/integrations/connections/${id}`, opts);
  }

  async startConnection(
    input: StartConnectionInput,
    opts?: RequestOptions,
  ): Promise<StartConnectionResult> {
    return this.http.post<StartConnectionResult>(
      "/integrations/connections/start",
      input,
      opts,
    );
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
