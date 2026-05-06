import { describe, test, expect } from "bun:test";
import { Deyta } from "../src/index.js";
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

const personaPayload = (overrides: Partial<{ id: string; namespace_id: string; external_reference_id: string | null }> = {}) => ({
  id: overrides.id ?? "agt_1",
  org_id: "org_1",
  namespace_id: overrides.namespace_id ?? "ns_1",
  external_reference_id: overrides.external_reference_id ?? null,
  subject: "Alice",
  description: null,
  created_at: "2026-04-27T00:00:00Z",
  updated_at: "2026-04-27T00:00:00Z",
  built: false,
});

describe("personas.scope(id)", () => {
  test("metadata() hits /personas/:id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(personaPayload({ id: "agt_42" })));
    const p = deyta.personas.scope("agt_42");
    const meta = await p.metadata();
    expect(meta.id).toBe("agt_42");
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_42$/);
  });

  test("delete() goes to /personas/:id directly when scoped by id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => noBody());
    const p = deyta.personas.scope("agt_42");
    await p.delete();
    expect(mock.requests.length).toBe(1);
    expect(mock.requests[0]?.method).toBe("DELETE");
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_42$/);
  });

  test("update() PATCHes /personas/:id without an id-resolution fetch", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk({ ...personaPayload({ id: "agt_42" }), description: "x" }));
    const p = deyta.personas.scope("agt_42");
    await p.update({ description: "x" });
    expect(mock.requests.length).toBe(1);
    expect(mock.requests[0]?.method).toBe("PATCH");
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_42$/);
    expect(mock.requests[0]?.body).toEqual({ description: "x" });
  });

  test("build() POSTs to /personas/:id/build with empty body by default", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk({ build_id: "bld_1", status: "accepted" as const }, 202));
    const p = deyta.personas.scope("agt_42");
    const accepted = await p.build();
    expect(accepted.build_id).toBe("bld_1");
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_42\/build$/);
    expect(mock.requests[0]?.body).toEqual({});
  });

  test("status() GETs /personas/:id/status", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        status: "ready" as const,
        last_built_at: "2026-04-27T01:00:00Z",
        summary: {
          available: true,
          generated_at: "2026-04-27T02:00:00Z",
          persona_built_at: "2026-04-27T01:00:00Z",
        },
      }),
    );
    const p = deyta.personas.scope("agt_42");
    const s = await p.status();
    expect(s.status).toBe("ready");
    expect(s.summary.available).toBe(true);
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_42\/status$/);
  });

  test("getSummary()/generateSummary() hit /personas/:id/summary", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        summary: "s",
        generated_at: "2026-04-28T11:00:00Z",
        persona_built_at: "2026-04-28T10:00:00Z",
      }),
    );
    const p = deyta.personas.scope("agt_42");
    await p.getSummary();
    await p.generateSummary({ temperature: 0.4 });
    expect(mock.requests[0]?.method).toBe("GET");
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_42\/summary$/);
    expect(mock.requests[1]?.method).toBe("POST");
    expect(mock.requests[1]?.body).toEqual({ temperature: 0.4 });
  });

  test("remember resolves namespace_id via metadata, then injects it", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls += 1;
      if (calls === 1) return jsonOk(personaPayload({ id: "agt_42", namespace_id: "ns_99" }));
      return jsonOk({
        document_id: "doc_1",
        chunks_created: 1,
        entities_extracted: 0,
        relationships_created: 0,
      });
    });
    const p = deyta.personas.scope("agt_42");
    await p.remember({ content: "hi" });
    expect(mock.requests.length).toBe(2);
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_42$/);
    expect(mock.requests[1]?.url).toMatch(/\/remember$/);
    const body = mock.requests[1]?.body as Record<string, unknown>;
    expect(body.namespace_id).toBe("ns_99");
    expect(body.content).toBe("hi");
    expect(body.external_reference_id).toBeUndefined();
  });

  test("memory ops cache the resolved namespace_id across calls", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls += 1;
      if (calls === 1) return jsonOk(personaPayload({ id: "agt_42", namespace_id: "ns_99" }));
      return jsonOk({
        document_id: "doc_1",
        chunks_created: 1,
        entities_extracted: 0,
        relationships_created: 0,
      });
    });
    const p = deyta.personas.scope("agt_42");
    await p.remember({ content: "a" });
    await p.remember({ content: "b" });
    expect(mock.requests.length).toBe(3);
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_42$/);
    expect(mock.requests[1]?.url).toMatch(/\/remember$/);
    expect(mock.requests[2]?.url).toMatch(/\/remember$/);
    expect((mock.requests[2]?.body as Record<string, unknown>).namespace_id).toBe("ns_99");
  });

  test("recall preserves time bounds and adds the persona's namespace_id", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls += 1;
      if (calls === 1) return jsonOk(personaPayload({ id: "agt_42", namespace_id: "ns_99" }));
      return jsonOk({
        query: "x",
        namespace_id: "ns_99",
        chunks: [],
        entities: [],
        context_text: "",
        llm_usage: [],
      });
    });
    const p = deyta.personas.scope("agt_42");
    await p.recall({ query: "x", from: new Date("2026-01-01T00:00:00Z") });
    const body = mock.requests[1]?.body as Record<string, unknown>;
    expect(body.namespace_id).toBe("ns_99");
    expect(body.start_time).toBe("2026-01-01T00:00:00.000Z");
  });

  test("integrations.list flattens scope into target_type=persona&target_id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonPaginated([], { page: 1, pageSize: 20, total: 0, totalPages: 0 }),
    );
    const p = deyta.personas.scope("agt_42");
    await p.integrations.list();
    const url = new URL(mock.requests[0]!.url);
    expect(url.searchParams.get("target_type")).toBe("persona");
    expect(url.searchParams.get("target_id")).toBe("agt_42");
  });

  test("integrations.start nests target=persona into body", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        id: "conn_1",
        org_id: "org",
        namespace_id: "ns_99",
        persona_id: "agt_42",
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
    const p = deyta.personas.scope("agt_42");
    await p.integrations.start({ provider: "google_drive" });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.target).toEqual({ type: "persona", id: "agt_42" });
    expect(body.provider).toBe("google_drive");
  });
});

describe("personas.scopeByExternalRef(ref)", () => {
  test("metadata() hits /personas/reference/:ref", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk(personaPayload({ id: "agt_77", external_reference_id: "user-abc" })),
    );
    const p = deyta.personas.scopeByExternalRef("user-abc");
    const meta = await p.metadata();
    expect(meta.id).toBe("agt_77");
    expect(mock.requests[0]?.url).toMatch(/\/personas\/reference\/user-abc$/);
  });

  test("delete() resolves the id via metadata first, then DELETEs by id", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls += 1;
      if (calls === 1) {
        return jsonOk(
          personaPayload({ id: "agt_77", external_reference_id: "user-abc" }),
        );
      }
      return noBody();
    });
    const p = deyta.personas.scopeByExternalRef("user-abc");
    await p.delete();
    expect(mock.requests.length).toBe(2);
    expect(mock.requests[0]?.url).toMatch(/\/personas\/reference\/user-abc$/);
    expect(mock.requests[1]?.method).toBe("DELETE");
    expect(mock.requests[1]?.url).toMatch(/\/personas\/agt_77$/);
  });

  test("status() resolves the id via metadata, then GETs /personas/:id/status", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls += 1;
      if (calls === 1) {
        return jsonOk(
          personaPayload({ id: "agt_77", external_reference_id: "user-abc" }),
        );
      }
      return jsonOk({
        status: "ready" as const,
        last_built_at: null,
        summary: { available: false, generated_at: null, persona_built_at: null },
      });
    });
    const p = deyta.personas.scopeByExternalRef("user-abc");
    await p.status();
    expect(mock.requests.length).toBe(2);
    expect(mock.requests[1]?.url).toMatch(/\/personas\/agt_77\/status$/);
  });

  test("remember resolves namespace_id once, then injects on every call", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls += 1;
      if (calls === 1) {
        return jsonOk(
          personaPayload({
            id: "agt_77",
            namespace_id: "ns_88",
            external_reference_id: "user-abc",
          }),
        );
      }
      return jsonOk({
        document_id: "doc",
        chunks_created: 1,
        entities_extracted: 0,
        relationships_created: 0,
      });
    });
    const p = deyta.personas.scopeByExternalRef("user-abc");
    await p.remember({ content: "a" });
    await p.remember({ content: "b" });
    expect(mock.requests.length).toBe(3);
    expect(mock.requests[0]?.url).toMatch(/\/personas\/reference\/user-abc$/);
    const body1 = mock.requests[1]?.body as Record<string, unknown>;
    const body2 = mock.requests[2]?.body as Record<string, unknown>;
    expect(body1.namespace_id).toBe("ns_88");
    expect(body2.namespace_id).toBe("ns_88");
  });

  test("integrations.list uses target_external_reference_id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonPaginated([], { page: 1, pageSize: 20, total: 0, totalPages: 0 }),
    );
    const p = deyta.personas.scopeByExternalRef("user-abc");
    await p.integrations.list();
    const url = new URL(mock.requests[0]!.url);
    expect(url.searchParams.get("target_type")).toBe("persona");
    expect(url.searchParams.get("target_external_reference_id")).toBe("user-abc");
    expect(url.searchParams.get("target_id")).toBeNull();
  });

  test("integrations.start nests target with external_reference_id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        id: "conn_1",
        org_id: "org",
        namespace_id: "ns_88",
        persona_id: "agt_77",
        provider: "notion",
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
    const p = deyta.personas.scopeByExternalRef("user-abc");
    await p.integrations.start({ provider: "notion" });
    expect(mock.requests[0]?.body).toEqual({
      target: { type: "persona", external_reference_id: "user-abc" },
      provider: "notion",
    });
  });
});
