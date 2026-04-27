import { describe, test, expect } from "bun:test";
import { Deyta, DeytaError } from "../src/index.js";
import { FetchMock, jsonError, jsonOk } from "./_fetch-mock.js";

function setup() {
  const mock = new FetchMock();
  const deyta = new Deyta({
    apiKey: "k",
    fetch: mock.fetch,
    retries: { maxRetries: 0 },
  });
  return { deyta, mock };
}

const binding = (overrides: Partial<{ agent_id: string; subject: string | null }> = {}) => ({
  agent_id: overrides.agent_id ?? "agt_1",
  namespace_id: "ns_1",
  role: "primary" as const,
  subject: overrides.subject ?? "Alice",
  is_active: true,
  last_built_at: null,
  created_at: "2026-04-27T00:00:00Z",
  updated_at: "2026-04-27T00:00:00Z",
});

describe("Personas", () => {
  test("create POSTs body and returns 201 binding", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(binding(), 201));
    const result = await deyta.personas.create({ namespace_id: "ns_1", subject: "Alice" });
    expect(result.agent_id).toBe("agt_1");
    expect(result.subject).toBe("Alice");
    expect(mock.requests[0]?.method).toBe("POST");
    expect(mock.requests[0]?.url).toMatch(/\/personas$/);
    expect(mock.requests[0]?.body).toEqual({ namespace_id: "ns_1", subject: "Alice" });
  });

  test("create returns existing binding on 200 (idempotent)", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(binding({ subject: "Original" }), 200));
    const result = await deyta.personas.create({
      external_reference_id: "ref_1",
      subject: "Ignored",
    });
    expect(result.subject).toBe("Original");
    expect(mock.requests[0]?.body).toEqual({
      external_reference_id: "ref_1",
      subject: "Ignored",
    });
  });

  test("build POSTs to /personas/build and returns BuildAccepted (202)", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({ build_id: "bld_1", agent_id: "agt_1", status: "accepted" as const }, 202),
    );
    const result = await deyta.personas.build({ namespace_id: "ns_1" });
    expect(result.build_id).toBe("bld_1");
    expect(result.status).toBe("accepted");
    expect(mock.requests[0]?.method).toBe("POST");
    expect(mock.requests[0]?.url).toMatch(/\/personas\/build$/);
    expect(mock.requests[0]?.body).toEqual({ namespace_id: "ns_1" });
  });

  test("status GETs /personas/status with namespace_id query", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        agent_id: "agt_1",
        status: "ready" as const,
        last_built_at: "2026-04-27T01:00:00Z",
      }),
    );
    const result = await deyta.personas.status({ namespace_id: "ns_1" });
    expect(result.status).toBe("ready");
    const url = new URL(mock.requests[0]!.url);
    expect(url.pathname).toMatch(/\/personas\/status$/);
    expect(url.searchParams.get("namespace_id")).toBe("ns_1");
  });

  test("status accepts external_reference_id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({ agent_id: "agt_1", status: "building" as const, last_built_at: null }),
    );
    await deyta.personas.status({ external_reference_id: "ref_1" });
    const url = new URL(mock.requests[0]!.url);
    expect(url.searchParams.get("external_reference_id")).toBe("ref_1");
    expect(url.searchParams.get("namespace_id")).toBeNull();
  });

  test("read GETs /personas with namespace_id query and returns ComposedPersona", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        agent_id: "agt_1",
        identity: { name: "Alice" },
        traits: [],
        episodes: [],
      }),
    );
    const result = await deyta.personas.read({ namespace_id: "ns_1" });
    expect(result.agent_id).toBe("agt_1");
    expect(result.identity).toEqual({ name: "Alice" });
    const url = new URL(mock.requests[0]!.url);
    expect(url.pathname).toMatch(/\/personas$/);
    expect(url.searchParams.get("namespace_id")).toBe("ns_1");
  });

  test("read surfaces 404 as DeytaError NOT_FOUND", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonError(404, "NOT_FOUND", "No persona binding for this namespace"));
    await expect(deyta.personas.read({ namespace_id: "ns_1" })).rejects.toBeInstanceOf(DeytaError);
  });

  test("scope().personas.create injects namespace target", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(binding(), 201));
    await deyta.namespaces.scope("ns_1").personas.create({ subject: "Alice" });
    expect(mock.requests[0]?.body).toEqual({ namespace_id: "ns_1", subject: "Alice" });
  });

  test("scope().personas.build/status/read use scope target", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls += 1;
      if (calls === 1) {
        return jsonOk({ build_id: "bld_1", agent_id: "agt_1", status: "accepted" as const }, 202);
      }
      if (calls === 2) {
        return jsonOk({
          agent_id: "agt_1",
          status: "ready" as const,
          last_built_at: "2026-04-27T01:00:00Z",
        });
      }
      return jsonOk({ agent_id: "agt_1", traits: [] });
    });
    const scope = deyta.namespaces.scopeByExternalRef("ref_1");
    await scope.personas.build();
    await scope.personas.status();
    await scope.personas.read();

    expect(mock.requests[0]?.body).toEqual({ external_reference_id: "ref_1" });
    expect(new URL(mock.requests[1]!.url).searchParams.get("external_reference_id")).toBe("ref_1");
    expect(new URL(mock.requests[2]!.url).searchParams.get("external_reference_id")).toBe("ref_1");
  });
});
