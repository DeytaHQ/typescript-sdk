import { describe, test, expect } from "bun:test";
import { Deyta } from "../src/index.js";
import { FetchMock, jsonOk, noBody } from "./_fetch-mock.js";

function setup() {
  const mock = new FetchMock();
  const deyta = new Deyta({
    apiKey: "k",
    fetch: mock.fetch,
    retries: { maxRetries: 0 },
  });
  return { deyta, mock };
}

const namespacePayload = (id: string) => ({
  id,
  org_id: "org_1",
  name: id,
  description: null,
  external_reference_id: null,
  mcp_endpoint_url: `https://mcp/${id}`,
  created_at: "2026-04-26T00:00:00Z",
  updated_at: "2026-04-26T00:00:00Z",
});

describe("namespaces.scope(id)", () => {
  test("remember injects namespace_id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        document_id: "doc_1",
        chunks_created: 1,
        entities_extracted: 0,
        relationships_created: 0,
      }),
    );
    const ns = deyta.namespaces.scope("ns_42");
    await ns.remember({ content: "hi" });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.namespace_id).toBe("ns_42");
    expect(body.content).toBe("hi");
    expect(body.external_reference_id).toBeUndefined();
  });

  test("recall preserves time bounds and adds namespace_id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        query: "x",
        namespace_id: "ns_42",
        documents: [],
        chunks: [],
        entities: [],
        relationships: [],
        usage: [],
      }),
    );
    const ns = deyta.namespaces.scope("ns_42");
    await ns.recall({ query: "x", from: new Date("2026-01-01T00:00:00Z") });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.namespace_id).toBe("ns_42");
    expect(body.start_time).toBe("2026-01-01T00:00:00.000Z");
  });

  test("metadata() hits /namespaces/:id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(namespacePayload("ns_42")));
    const ns = deyta.namespaces.scope("ns_42");
    const meta = await ns.metadata();
    expect(meta.id).toBe("ns_42");
    expect(mock.requests[0]?.url).toMatch(/\/namespaces\/ns_42$/);
  });

  test("delete() goes to /namespaces/:id directly when scoped by id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => noBody());
    const ns = deyta.namespaces.scope("ns_42");
    await ns.delete();
    expect(mock.requests.length).toBe(1);
    expect(mock.requests[0]?.method).toBe("DELETE");
    expect(mock.requests[0]?.url).toMatch(/\/namespaces\/ns_42$/);
  });

  test("integrations.list flattens scope into target_type=namespace&target_id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk([]));
    const ns = deyta.namespaces.scope("ns_42");
    await ns.integrations.list();
    const url = new URL(mock.requests[0]!.url);
    expect(url.searchParams.get("target_type")).toBe("namespace");
    expect(url.searchParams.get("target_id")).toBe("ns_42");
  });

  test("integrations.start nests target=namespace into body", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        id: "conn_1",
        org_id: "org",
        namespace_id: "ns_42",
        persona_id: null,
        provider: "google_drive",
        connection_id: null,
        status: "pending",
        session_id: null,
        auth_link_url: "https://link",
        created_by: "u",
        created_at: "x",
        updated_at: "x",
        session_token: "tok",
      }),
    );
    const ns = deyta.namespaces.scope("ns_42");
    await ns.integrations.start({ provider: "google_drive" });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.target).toEqual({ type: "namespace", id: "ns_42" });
    expect(body.provider).toBe("google_drive");
  });
});

describe("namespaces.scopeByExternalRef(ref)", () => {
  test("remember injects external_reference_id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        document_id: "doc_1",
        chunks_created: 1,
        entities_extracted: 0,
        relationships_created: 0,
      }),
    );
    const ns = deyta.namespaces.scopeByExternalRef("user-abc");
    await ns.remember({ content: "hi" });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.external_reference_id).toBe("user-abc");
    expect(body.namespace_id).toBeUndefined();
  });

  test("metadata() hits /namespaces/external/:ref", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk({ ...namespacePayload("ns_77"), external_reference_id: "user-abc" }));
    const ns = deyta.namespaces.scopeByExternalRef("user-abc");
    const meta = await ns.metadata();
    expect(meta.id).toBe("ns_77");
    expect(mock.requests[0]?.url).toMatch(/\/namespaces\/external\/user-abc$/);
  });

  test("delete() resolves the id via metadata first, then DELETEs by id", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls++;
      if (calls === 1) {
        return jsonOk({
          ...namespacePayload("ns_77"),
          external_reference_id: "user-abc",
        });
      }
      return noBody();
    });
    const ns = deyta.namespaces.scopeByExternalRef("user-abc");
    await ns.delete();
    expect(mock.requests.length).toBe(2);
    expect(mock.requests[0]?.url).toMatch(/\/namespaces\/external\/user-abc$/);
    expect(mock.requests[1]?.method).toBe("DELETE");
    expect(mock.requests[1]?.url).toMatch(/\/namespaces\/ns_77$/);
  });
});
