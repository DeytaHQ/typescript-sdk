import { describe, test, expect } from "bun:test";
import { Deyta, DeytaError } from "../src/index.js";
import { FetchMock, jsonError, jsonOk, jsonPaginated, noBody } from "./_fetch-mock.js";

function setup() {
  const mock = new FetchMock();
  const deyta = new Deyta({
    apiKey: "k",
    fetch: mock.fetch,
    retries: { maxRetries: 0 },
  });
  return { deyta, mock };
}

const persona = (overrides: Partial<{ id: string; subject: string; externalReferenceId: string | null }> = {}) => ({
  id: overrides.id ?? "agt_1",
  orgId: "org_1",
  namespaceId: "ns_1",
  externalReferenceId: overrides.externalReferenceId ?? null,
  subject: overrides.subject ?? "Alice",
  description: null,
  createdAt: "2026-04-27T00:00:00Z",
  updatedAt: "2026-04-27T00:00:00Z",
});

describe("Personas", () => {
  test("create POSTs body and returns Persona (201)", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(persona({ externalReferenceId: "ref_1" }), 201));
    const result = await deyta.personas.create({
      subject: "Alice",
      external_reference_id: "ref_1",
      description: "demo",
    });
    expect(result.id).toBe("agt_1");
    expect(result.namespaceId).toBe("ns_1");
    expect(result.externalReferenceId).toBe("ref_1");
    expect(mock.requests[0]?.method).toBe("POST");
    expect(mock.requests[0]?.url).toMatch(/\/personas$/);
    expect(mock.requests[0]?.body).toEqual({
      subject: "Alice",
      external_reference_id: "ref_1",
      description: "demo",
    });
  });

  test("list returns paginated personas with query params", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonPaginated([persona()], { page: 1, pageSize: 20, total: 1, totalPages: 1 }),
    );
    const { data, pagination } = await deyta.personas.list({ page: 1, page_size: 20 });
    expect(data).toHaveLength(1);
    expect(data[0]?.id).toBe("agt_1");
    expect(pagination.total).toBe(1);
    const url = new URL(mock.requests[0]!.url);
    expect(url.pathname).toMatch(/\/personas$/);
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("page_size")).toBe("20");
  });

  test("iterate walks all pages", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls += 1;
      if (calls === 1) {
        return jsonPaginated([persona({ id: "agt_1" }), persona({ id: "agt_2" })], {
          page: 1,
          pageSize: 2,
          total: 3,
          totalPages: 2,
        });
      }
      return jsonPaginated([persona({ id: "agt_3" })], {
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      });
    });

    const ids: string[] = [];
    for await (const p of deyta.personas.iterate({ page_size: 2 })) ids.push(p.id);
    expect(ids).toEqual(["agt_1", "agt_2", "agt_3"]);
  });

  test("get returns PersonaWithDigor (available=true)", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        ...persona(),
        digor: {
          available: true,
          data: { agent_id: "agt_1", identity: { name: "Alice" }, traits: [] },
        },
      }),
    );
    const result = await deyta.personas.get("agt_1");
    expect(result.id).toBe("agt_1");
    expect(result.digor.available).toBe(true);
    if (result.digor.available) {
      expect(result.digor.data.agent_id).toBe("agt_1");
    }
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_1$/);
  });

  test("get surfaces digor.available=false envelope", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({ ...persona(), digor: { available: false } }),
    );
    const result = await deyta.personas.get("agt_1");
    expect(result.digor.available).toBe(false);
  });

  test("getByExternalRef hits /personas/reference/:externalRef", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({ ...persona({ externalReferenceId: "ref-A/B" }), digor: { available: false } }),
    );
    const result = await deyta.personas.getByExternalRef("ref-A/B");
    expect(result.externalReferenceId).toBe("ref-A/B");
    // Special chars must be percent-encoded.
    expect(mock.requests[0]?.url).toMatch(/\/personas\/reference\/ref-A%2FB$/);
  });

  test("update PATCHes /personas/:id with partial body", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({ ...persona(), description: "updated", externalReferenceId: null }),
    );
    const result = await deyta.personas.update("agt_1", {
      description: "updated",
      external_reference_id: null,
    });
    expect(result.description).toBe("updated");
    expect(result.externalReferenceId).toBeNull();
    expect(mock.requests[0]?.method).toBe("PATCH");
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_1$/);
    expect(mock.requests[0]?.body).toEqual({
      description: "updated",
      external_reference_id: null,
    });
  });

  test("delete returns void", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => noBody());
    const result = await deyta.personas.delete("agt_1");
    expect(result).toBeUndefined();
    expect(mock.requests[0]?.method).toBe("DELETE");
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_1$/);
  });

  test("build POSTs to /personas/:id/build and returns BuildAccepted (202)", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({ build_id: "bld_1", agent_id: "agt_1", status: "accepted" as const }, 202),
    );
    const result = await deyta.personas.build("agt_1");
    expect(result.build_id).toBe("bld_1");
    expect(result.status).toBe("accepted");
    expect(mock.requests[0]?.method).toBe("POST");
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_1\/build$/);
  });

  test("status GETs /personas/:id/status", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        agent_id: "agt_1",
        status: "ready" as const,
        last_built_at: "2026-04-27T01:00:00Z",
      }),
    );
    const result = await deyta.personas.status("agt_1");
    expect(result.status).toBe("ready");
    expect(mock.requests[0]?.url).toMatch(/\/personas\/agt_1\/status$/);
  });

  test("get surfaces 404 as DeytaError NOT_FOUND", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonError(404, "NOT_FOUND", "No persona with id agt_404"));
    await expect(deyta.personas.get("agt_404")).rejects.toBeInstanceOf(DeytaError);
  });
});
