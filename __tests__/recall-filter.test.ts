import { describe, test, expect } from "bun:test";
import { Deyta } from "../src/index.js";
import type { RecallFilter } from "../src/index.js";
import { FetchMock, jsonOk } from "./_fetch-mock.js";

function setup() {
  const mock = new FetchMock();
  const deyta = new Deyta({
    apiKey: "k",
    fetch: mock.fetch,
    retries: { maxRetries: 0 },
  });
  return { deyta, mock };
}

/** Minimal empty recall response body used by the wire-shape assertions. */
function emptyRecall() {
  return jsonOk({
    query: "q",
    namespace_id: "ns_1",
    documents: [],
    chunks: [],
    entities: [],
    relationships: [],
    usage: [],
  });
}

/** Minimal ask response body used by the ask wire-shape assertions. */
function emptyAsk() {
  return jsonOk({
    answer_id: "run_1",
    answer: "",
    sources: [],
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      total_tokens: 0,
      requests: 0,
      by_source: [],
    },
    timing: {
      started_at: "2026-01-01T00:00:00Z",
      finished_at: "2026-01-01T00:00:01Z",
      duration_ms: 1000,
    },
  });
}

describe("recall filter — wire shape", () => {
  test("forwards a scalar/string filter to the API verbatim", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => emptyRecall());
    const filter: RecallFilter = {
      source_type: { $in: ["api", "connection"] },
      "metadata.priority": { $gte: 5 },
    };
    await deyta.memory.recall({ namespace_id: "ns_1", query: "q", filter });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    // Verbatim: the request `filter` must deep-equal the object we passed.
    expect(body.filter).toEqual(filter);
  });

  test("forwards a nested logical filter verbatim", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => emptyRecall());
    const filter: RecallFilter = {
      $and: [
        { $or: [{ source_type: "api" }, { $not: { title: "draft" } }] },
        { "metadata.team": "growth" },
      ],
    };
    await deyta.memory.recall({ namespace_id: "ns_1", query: "q", filter });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.filter).toEqual(filter);
  });

  test("filter coexists with from/until serialized to start_time/end_time", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => emptyRecall());
    const from = new Date("2026-04-01T00:00:00.000Z");
    const until = new Date("2026-04-30T23:59:59.000Z");
    const filter: RecallFilter = { source_name: "granola" };
    await deyta.memory.recall({
      namespace_id: "ns_1",
      query: "q",
      from,
      until,
      filter,
    });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    // Time bounds still translate to the wire names…
    expect(body.start_time).toBe(from.toISOString());
    expect(body.end_time).toBe(until.toISOString());
    expect("from" in body).toBe(false);
    expect("until" in body).toBe(false);
    // …and the filter rides alongside them, untouched.
    expect(body.filter).toEqual(filter);
  });

  test("serializes a Date inside a date predicate to an ISO string on the wire", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => emptyRecall());
    const occurredAt = new Date("2026-01-01T00:00:00.000Z");
    const filter: RecallFilter = { occurred_at: { $gte: occurredAt } };
    await deyta.memory.recall({ namespace_id: "ns_1", query: "q", filter });
    // Assert against the raw JSON the client would put on the wire: a Date
    // becomes its ISO-8601 string once JSON.stringify runs.
    const wire = JSON.parse(JSON.stringify(mock.requests[0]?.body)) as {
      filter: { occurred_at: { $gte: string } };
    };
    expect(wire.filter.occurred_at.$gte).toBe(occurredAt.toISOString());
    expect(typeof wire.filter.occurred_at.$gte).toBe("string");
  });

  test("ask() forwards a filter verbatim alongside translated time bounds", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => emptyAsk());
    const from = new Date("2026-02-01T00:00:00.000Z");
    const filter: RecallFilter = {
      $or: [{ source_type: "api" }, { "metadata.pinned": true }],
    };
    await deyta.memory.ask({
      namespace_id: "ns_1",
      query: "is it ready?",
      from,
      filter,
    });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.filter).toEqual(filter);
    expect(body.start_time).toBe(from.toISOString());
    expect("from" in body).toBe(false);
  });

  test("ask() serializes a Date inside a date predicate to an ISO string", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => emptyAsk());
    const createdAt = new Date("2026-03-15T12:30:00.000Z");
    const filter: RecallFilter = { created_at: { $lt: createdAt } };
    await deyta.memory.ask({ namespace_id: "ns_1", query: "q", filter });
    const wire = JSON.parse(JSON.stringify(mock.requests[0]?.body)) as {
      filter: { created_at: { $lt: string } };
    };
    expect(wire.filter.created_at.$lt).toBe(createdAt.toISOString());
  });
});

describe("recall filter — accepted shapes (compile-time)", () => {
  // Belt-and-suspenders positive usages. The authoritative negative type test
  // lives under src/ (compiled by `type-check`); these just confirm a few valid
  // filters type-check and reach the wire from within the test suite too.
  test("a variety of valid filters type-check and round-trip", async () => {
    const { deyta, mock } = setup();
    const filters: RecallFilter[] = [
      { source_type: "connection" },
      { occurred_at: { $gte: "2026-01-01T00:00:00Z", $lt: new Date() } },
      { title: { $ne: "draft", $exists: true } },
      { "metadata.priority": { $gte: 5 } },
      { $not: { source_name: { $in: ["granola", "slack"] } } },
    ];
    for (const filter of filters) {
      mock.setHandler(() => emptyRecall());
      await deyta.memory.recall({ namespace_id: "ns_1", query: "q", filter });
    }
    expect(mock.requests).toHaveLength(filters.length);
  });
});

describe.skip("recall filter — live gateway round-trip", () => {
  // Requires a live gateway that has the typed-filter surface deployed, plus
  // real credentials and a seeded namespace. Kept skipped so the default suite
  // stays hermetic; unskip and configure the client against a running gateway
  // to exercise a genuine filtered recall end to end.
  test("recall with a filter returns only matching documents", async () => {
    const deyta = new Deyta({ apiKey: process.env.DEYTA_API_KEY });
    const filter: RecallFilter = { source_type: "connection" };
    const result = await deyta.memory.recall({
      external_id: "live-namespace",
      query: "quarterly planning",
      filter,
    });
    expect(Array.isArray(result.documents)).toBe(true);
    for (const doc of result.documents) {
      expect(doc.source_type).toBe("connection");
    }
  });
});
