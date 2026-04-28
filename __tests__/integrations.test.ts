import { describe, test, expect } from "bun:test";
import { Deyta, DeytaError } from "../src/index.js";
import { FetchMock, jsonOk, jsonPaginated, noBody } from "./_fetch-mock.js";

function setup() {
  const mock = new FetchMock();
  const deyta = new Deyta({
    apiKey: "k",
    fetch: mock.fetch,
    retries: { maxRetries: 0 },
  });
  return { deyta, mock };
}

const conn = (id: string) => ({
  id,
  org_id: "org_1",
  namespace_id: "ns_1",
  persona_id: null,
  provider: "google_drive",
  connection_id: null,
  status: "pending" as const,
  session_id: null,
  auth_link_url: null,
  created_by: "u_1",
  created_at: "2026-04-26T00:00:00Z",
  updated_at: "2026-04-26T00:00:00Z",
});

describe("Integrations", () => {
  test("listProviders hits /integrations/list", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk([{ provider: "google_drive", name: "Google Drive", type: "oauth", enabled: true }]),
    );
    const providers = await deyta.integrations.listProviders();
    expect(providers[0]?.provider).toBe("google_drive");
    expect(mock.requests[0]?.url).toMatch(/\/integrations\/list$/);
  });

  test("listConnections returns top-level paginated envelope", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonPaginated([conn("conn_1")], {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      }),
    );
    const result = await deyta.integrations.listConnections({
      type: "namespace",
      id: "ns_1",
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("conn_1");
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    const url = new URL(mock.requests[0]!.url);
    expect(url.searchParams.get("target_type")).toBe("namespace");
    expect(url.searchParams.get("target_id")).toBe("ns_1");
    expect(url.searchParams.get("target_external_reference_id")).toBeNull();
  });

  test("listConnections forwards page / page_size when provided", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonPaginated([], { page: 2, pageSize: 50, total: 75, totalPages: 2 }),
    );
    await deyta.integrations.listConnections({
      type: "namespace",
      id: "ns_1",
      page: 2,
      page_size: 50,
    });
    const url = new URL(mock.requests[0]!.url);
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("page_size")).toBe("50");
  });

  test("listConnections flattens persona+external_reference_id target", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonPaginated([{ ...conn("conn_1"), persona_id: "agt_1" }], {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      }),
    );
    await deyta.integrations.listConnections({
      type: "persona",
      external_reference_id: "ref_1",
    });
    const url = new URL(mock.requests[0]!.url);
    expect(url.searchParams.get("target_type")).toBe("persona");
    expect(url.searchParams.get("target_external_reference_id")).toBe("ref_1");
    expect(url.searchParams.get("target_id")).toBeNull();
  });

  test("iterateConnections walks every page", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls += 1;
      if (calls === 1) {
        return jsonPaginated([conn("c1"), conn("c2")], {
          page: 1,
          pageSize: 2,
          total: 3,
          totalPages: 2,
        });
      }
      return jsonPaginated([conn("c3")], {
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      });
    });
    const ids: string[] = [];
    for await (const c of deyta.integrations.iterateConnections(
      { type: "namespace", id: "ns_1" },
      { page_size: 2 },
    )) {
      ids.push(c.id);
    }
    expect(ids).toEqual(["c1", "c2", "c3"]);
    expect(mock.requests).toHaveLength(2);
    const firstUrl = new URL(mock.requests[0]!.url);
    expect(firstUrl.searchParams.get("page")).toBe("1");
    expect(firstUrl.searchParams.get("page_size")).toBe("2");
    const secondUrl = new URL(mock.requests[1]!.url);
    expect(secondUrl.searchParams.get("page")).toBe("2");
  });

  test("getConnection hits /integrations/connections/:id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk({ ...conn("conn_1"), persona_id: "agt_1" }));
    const c = await deyta.integrations.getConnection("conn_1");
    expect(c.id).toBe("conn_1");
    expect(c.persona_id).toBe("agt_1");
    expect(mock.requests[0]?.url).toMatch(/\/integrations\/connections\/conn_1$/);
  });

  test("startConnection wraps target in nested body", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({ ...conn("conn_1"), session_token: "tok", auth_link_url: "https://link" }),
    );
    const result = await deyta.integrations.startConnection({
      target: { type: "namespace", id: "ns_1" },
      provider: "google_drive",
    });
    expect(result.session_token).toBe("tok");
    expect(mock.requests[0]?.method).toBe("POST");
    expect(mock.requests[0]?.url).toMatch(/\/integrations\/connections\/start$/);
    expect(mock.requests[0]?.body).toEqual({
      target: { type: "namespace", id: "ns_1" },
      provider: "google_drive",
    });
  });

  test("deleteConnection returns void", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => noBody());
    const result = await deyta.integrations.deleteConnection("conn_1");
    expect(result).toBeUndefined();
    expect(mock.requests[0]?.method).toBe("DELETE");
  });

  test("scope().integrations.list/start use namespace target", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls += 1;
      if (calls === 1) {
        return jsonPaginated([conn("conn_1")], {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        });
      }
      return jsonOk({ ...conn("conn_2"), session_token: "tok", auth_link_url: "https://link" });
    });

    const ns = deyta.namespaces.scopeByExternalRef("ref_ns");
    const page = await ns.integrations.list();
    expect(page.data).toHaveLength(1);
    expect(page.pagination.total).toBe(1);
    await ns.integrations.start({ provider: "notion" });

    const listUrl = new URL(mock.requests[0]!.url);
    expect(listUrl.searchParams.get("target_type")).toBe("namespace");
    expect(listUrl.searchParams.get("target_external_reference_id")).toBe("ref_ns");

    expect(mock.requests[1]?.body).toEqual({
      target: { type: "namespace", external_reference_id: "ref_ns" },
      provider: "notion",
    });
  });
});

describe("Integrations path-segment encoding", () => {
  test("getConnection encodes traversal sequences", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(conn("conn_1")));
    await deyta.integrations.getConnection("../admin");
    expect(mock.requests[0]?.url).toContain("/integrations/connections/..%2Fadmin");
    expect(mock.requests[0]?.url).not.toContain("/integrations/connections/../admin");
  });

  test("getConnection rejects '..'", async () => {
    const { deyta, mock } = setup();
    await expect(deyta.integrations.getConnection("..")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mock.requests.length).toBe(0);
  });

  test("getConnection rejects empty id", async () => {
    const { deyta, mock } = setup();
    await expect(deyta.integrations.getConnection("")).rejects.toBeInstanceOf(DeytaError);
    expect(mock.requests.length).toBe(0);
  });

  test("getConnection encodes embedded query separator", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(conn("conn_1")));
    await deyta.integrations.getConnection("a?force=true");
    expect(mock.requests[0]?.url).toContain("/integrations/connections/a%3Fforce%3Dtrue");
  });

  test("deleteConnection encodes traversal sequences", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => noBody());
    await deyta.integrations.deleteConnection("../../admin/keys/abc");
    expect(mock.requests[0]?.method).toBe("DELETE");
    expect(mock.requests[0]?.url).toContain(
      "/integrations/connections/..%2F..%2Fadmin%2Fkeys%2Fabc",
    );
    expect(mock.requests[0]?.url).not.toContain("/admin/keys/abc");
  });

  test("deleteConnection rejects '..'", async () => {
    const { deyta, mock } = setup();
    await expect(deyta.integrations.deleteConnection("..")).rejects.toBeInstanceOf(DeytaError);
    expect(mock.requests.length).toBe(0);
  });
});
