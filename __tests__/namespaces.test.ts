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

const ns = (id: string, extra: Partial<{ name: string }> = {}) => ({
  id,
  org_id: "org_1",
  name: extra.name ?? `ns ${id}`,
  description: null,
  external_reference_id: null,
  mcp_endpoint_url: `https://mcp.deyta.ai/${id}`,
  created_at: "2026-04-26T00:00:00Z",
  updated_at: "2026-04-26T00:00:00Z",
});

describe("Namespaces CRUD", () => {
  test("create posts to /namespaces", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(ns("ns_1", { name: "My NS" })));
    const result = await deyta.namespaces.create({ name: "My NS" });
    expect(result.id).toBe("ns_1");
    expect(mock.requests[0]?.method).toBe("POST");
    expect(mock.requests[0]?.url).toMatch(/\/namespaces$/);
  });

  test("get hits /namespaces/:id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(ns("ns_1")));
    await deyta.namespaces.get("ns_1");
    expect(mock.requests[0]?.url).toMatch(/\/namespaces\/ns_1$/);
  });

  test("getByExternalRef hits /namespaces/external/:ref", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(ns("ns_1")));
    await deyta.namespaces.getByExternalRef("user-abc");
    expect(mock.requests[0]?.url).toMatch(/\/namespaces\/external\/user-abc$/);
  });

  test("delete returns void on 204", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => noBody());
    const result = await deyta.namespaces.delete("ns_1");
    expect(result).toBeUndefined();
  });
});

describe("Namespaces path-segment encoding", () => {
  test("get encodes traversal sequences instead of letting them resolve", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(ns("ns_1")));
    await deyta.namespaces.get("../admin");
    expect(mock.requests[0]?.url).toContain("/namespaces/..%2Fadmin");
    expect(mock.requests[0]?.url).not.toContain("/namespaces/../admin");
  });

  test("get rejects '..' before any network call", async () => {
    const { deyta, mock } = setup();
    await expect(deyta.namespaces.get("..")).rejects.toMatchObject({
      name: "DeytaError",
      code: "BAD_REQUEST",
    });
    expect(mock.requests.length).toBe(0);
  });

  test("get rejects empty id before any network call", async () => {
    const { deyta, mock } = setup();
    await expect(deyta.namespaces.get("")).rejects.toBeInstanceOf(DeytaError);
    expect(mock.requests.length).toBe(0);
  });

  test("get encodes embedded query separator", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(ns("ns_1")));
    await deyta.namespaces.get("a?force=true");
    expect(mock.requests[0]?.url).toContain("/namespaces/a%3Fforce%3Dtrue");
  });

  test("get encodes embedded slash", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(ns("ns_1")));
    await deyta.namespaces.get("a/b");
    expect(mock.requests[0]?.url).toContain("/namespaces/a%2Fb");
  });

  test("get encodes embedded fragment", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(ns("ns_1")));
    await deyta.namespaces.get("a#x");
    expect(mock.requests[0]?.url).toContain("/namespaces/a%23x");
  });

  test("getByExternalRef encodes traversal sequences", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(ns("ns_1")));
    await deyta.namespaces.getByExternalRef("../../admin");
    expect(mock.requests[0]?.url).toContain("/namespaces/external/..%2F..%2Fadmin");
    expect(mock.requests[0]?.url).not.toContain("/admin");
  });

  test("getByExternalRef rejects '.'", async () => {
    const { deyta, mock } = setup();
    await expect(deyta.namespaces.getByExternalRef(".")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mock.requests.length).toBe(0);
  });

  test("delete encodes traversal sequences instead of routing to a sibling endpoint", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => noBody());
    await deyta.namespaces.delete("../admin/keys/abc");
    expect(mock.requests[0]?.method).toBe("DELETE");
    expect(mock.requests[0]?.url).toContain("/namespaces/..%2Fadmin%2Fkeys%2Fabc");
    expect(mock.requests[0]?.url).not.toContain("/admin/keys/abc");
  });

  test("delete rejects '..'", async () => {
    const { deyta, mock } = setup();
    await expect(deyta.namespaces.delete("..")).rejects.toBeInstanceOf(DeytaError);
    expect(mock.requests.length).toBe(0);
  });
});

describe("Namespaces.list and iterate", () => {
  test("list returns one page with pagination", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonPaginated([ns("a"), ns("b")], { page: 1, pageSize: 2, total: 4, totalPages: 2 }),
    );
    const result = await deyta.namespaces.list({ page: 1, page_size: 2 });
    expect(result.data.length).toBe(2);
    expect(result.pagination.totalPages).toBe(2);
  });

  test("iterate yields across pages until exhausted", async () => {
    const { deyta, mock } = setup();
    const pages: Record<number, [string, string][]> = {
      1: [["a", "b"], ["c", "d"]] as unknown as [string, string][],
    };
    pages[1] = [["a", "b"]] as unknown as [string, string][];
    mock.setHandler((req) => {
      const url = new URL(req.url);
      const page = Number(url.searchParams.get("page") ?? "1");
      if (page === 1) {
        return jsonPaginated([ns("a"), ns("b")], {
          page: 1,
          pageSize: 2,
          total: 3,
          totalPages: 2,
        });
      }
      return jsonPaginated([ns("c")], {
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      });
    });

    const ids: string[] = [];
    for await (const item of deyta.namespaces.iterate({ page_size: 2 })) {
      ids.push(item.id);
    }
    expect(ids).toEqual(["a", "b", "c"]);
    expect(mock.requests.length).toBe(2);
  });
});
