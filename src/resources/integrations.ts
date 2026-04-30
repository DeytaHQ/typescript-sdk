import { buildQuery, seg, type HttpClient, type PaginatedResult } from "../client.js";
import { paginate, type IterateParams } from "../pagination.js";
import type {
  DataSourceConnection,
  IntegrationSetting,
  ListConnectionsParams,
  RequestOptions,
  StartConnectionInput,
  StartConnectionResult,
  Target,
} from "../types.js";

/**
 * Flatten a `ListConnectionsParams` into the query-string the gateway
 * expects: `target_type`, `target_id` / `target_external_reference_id`,
 * plus optional `page` / `page_size`.
 */
function paramsToQuery(
  params: ListConnectionsParams,
): Record<string, string | number | undefined> {
  return {
    target_type: params.type,
    target_id: "id" in params ? params.id : undefined,
    target_external_reference_id:
      "external_reference_id" in params ? params.external_reference_id : undefined,
    page: params.page,
    page_size: params.page_size,
  };
}

export class Integrations {
  constructor(private readonly http: HttpClient) {}

  async listProviders(opts?: RequestOptions): Promise<IntegrationSetting[]> {
    return this.http.get<IntegrationSetting[]>("/integrations/list", opts);
  }

  /**
   * List connections for a target (namespace or persona). Returns a
   * `PaginatedResult<DataSourceConnection>` matching the gateway's standard
   * top-level `{ data, pagination }` envelope.
   */
  async listConnections(
    params: ListConnectionsParams,
    opts?: RequestOptions,
  ): Promise<PaginatedResult<DataSourceConnection>> {
    const query = buildQuery(paramsToQuery(params));
    return this.http.getPaginated<DataSourceConnection>(
      `/integrations/connections${query}`,
      opts,
    );
  }

  /**
   * Async iterator that walks every page of connections for a target.
   * Yields one `DataSourceConnection` per item.
   */
  iterateConnections(
    target: Target,
    params?: IterateParams,
    opts?: RequestOptions,
  ): AsyncGenerator<DataSourceConnection, void, void> {
    const pageSize = params?.page_size;
    return paginate<DataSourceConnection>((page) =>
      this.listConnections({ ...target, page, page_size: pageSize }, opts),
    );
  }

  async getConnection(id: string, opts?: RequestOptions): Promise<DataSourceConnection> {
    return this.http.get<DataSourceConnection>(`/integrations/connections/${seg(id)}`, opts);
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

  async deleteConnection(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete(`/integrations/connections/${seg(id)}`, opts);
  }
}
