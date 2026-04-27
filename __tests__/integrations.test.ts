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

const conn = (id: string) => ({
  id,
  orgId: "org_1",
  namespaceId: "ns_1",
  personaId: null,
  provider: "google_drive",
  connectionId: null,
  status: "pending" as const,
  sessionId: null,
  authLinkUrl: null,
  createdBy: "u_1",
  createdAt: "2026-04-26T00:00:00Z",
  updatedAt: "2026-04-26T00:00:00Z",
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

  test("listConnections flattens namespace target into target_type / target_id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk([conn("conn_1")]));
    await deyta.integrations.listConnections({ type: "namespace", id: "ns_1" });
    const url = new URL(mock.requests[0]!.url);
    expect(url.searchParams.get("target_type")).toBe("namespace");
    expect(url.searchParams.get("target_id")).toBe("ns_1");
    expect(url.searchParams.get("target_external_reference_id")).toBeNull();
  });

  test("listConnections flattens persona+external_reference_id target", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk([{ ...conn("conn_1"), personaId: "agt_1" }]));
    await deyta.integrations.listConnections({
      type: "persona",
      external_reference_id: "ref_1",
    });
    const url = new URL(mock.requests[0]!.url);
    expect(url.searchParams.get("target_type")).toBe("persona");
    expect(url.searchParams.get("target_external_reference_id")).toBe("ref_1");
    expect(url.searchParams.get("target_id")).toBeNull();
  });

  test("getConnection hits /integrations/connections/:id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk({ ...conn("conn_1"), personaId: "agt_1" }));
    const c = await deyta.integrations.getConnection("conn_1");
    expect(c.id).toBe("conn_1");
    expect(c.personaId).toBe("agt_1");
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
      if (calls === 1) return jsonOk([conn("conn_1")]);
      return jsonOk({ ...conn("conn_2"), session_token: "tok", auth_link_url: "https://link" });
    });

    const ns = deyta.namespaces.scopeByExternalRef("ref_ns");
    await ns.integrations.list();
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
