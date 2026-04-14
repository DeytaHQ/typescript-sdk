import { buildQuery, type HttpClient, type PaginatedResult } from "../client.js";
import type {
  CreateNamespaceInput,
  ListNamespacesParams,
  Namespace,
  RequestOptions,
} from "../types.js";

export class Namespaces {
  constructor(private readonly http: HttpClient) {}

  async create(input: CreateNamespaceInput, opts?: RequestOptions): Promise<Namespace> {
    return this.http.post<Namespace>("/namespaces", input, opts);
  }

  async list(
    params?: ListNamespacesParams,
    opts?: RequestOptions,
  ): Promise<PaginatedResult<Namespace>> {
    const query = buildQuery(params ?? {});
    return this.http.getPaginated<Namespace>(`/namespaces${query}`, opts);
  }

  async get(id: string, opts?: RequestOptions): Promise<Namespace> {
    return this.http.get<Namespace>(`/namespaces/${id}`, opts);
  }

  async getByExternalId(externalId: string, opts?: RequestOptions): Promise<Namespace> {
    return this.http.get<Namespace>(`/namespaces/external/${externalId}`, opts);
  }

  async delete(id: string, opts?: RequestOptions): Promise<{ deleted: boolean }> {
    return this.http.request<{ deleted: boolean }>("DELETE", `/namespaces/${id}`, undefined, opts);
  }
}
