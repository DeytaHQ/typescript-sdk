import { describe, test, expect } from "bun:test";
import { Deyta, DeytaError, REMEMBER_BATCH_MAX_DOCUMENTS } from "../src/index.js";
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

describe("Memory.remember", () => {
  test("posts to /remember and types the result", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        document_id: "doc_1",
        chunks_created: 3,
        entities_extracted: 5,
        relationships_created: 2,
      }),
    );
    const result = await deyta.memory.remember({
      namespace_id: "ns_1",
      content: "hello world",
      title: "greeting",
    });
    expect(result.document_id).toBe("doc_1");
    expect(result.chunks_created).toBe(3);
    expect(mock.requests[0]?.url).toMatch(/\/gateway\/v1\/remember$/);
    expect(mock.requests[0]?.method).toBe("POST");
    expect(mock.requests[0]?.body).toMatchObject({
      namespace_id: "ns_1",
      content: "hello world",
      title: "greeting",
    });
  });
});

describe("Memory.rememberBatch", () => {
  const aggregate = {
    total: 3,
    processed: 3,
    skipped: 0,
    failed: 0,
    chunks_created: 12,
    entities_extracted: 18,
    relationships_created: 9,
  };

  test("posts to /remember/batch and types the aggregate result", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk(aggregate));
    const result = await deyta.memory.rememberBatch({
      namespace_id: "ns_1",
      ontology_id: "ont_1",
      documents: [
        { content: "first", title: "a" },
        { content: "second", external_document_id: "ext-2" },
        { content: "third", source_timestamp: "2026-04-01T00:00:00Z" },
      ],
    });
    expect(result).toEqual(aggregate);
    expect(mock.requests[0]?.url).toMatch(/\/gateway\/v1\/remember\/batch$/);
    expect(mock.requests[0]?.method).toBe("POST");
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.namespace_id).toBe("ns_1");
    expect(body.ontology_id).toBe("ont_1");
    expect(Array.isArray(body.documents)).toBe(true);
    expect((body.documents as unknown[]).length).toBe(3);
    expect(body.documents).toMatchObject([
      { content: "first", title: "a" },
      { content: "second", external_document_id: "ext-2" },
      { content: "third", source_timestamp: "2026-04-01T00:00:00Z" },
    ]);
  });

  test("surfaces partial failure via the failed/skipped counts (still resolves)", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        total: 3,
        processed: 1,
        skipped: 1,
        failed: 1,
        chunks_created: 4,
        entities_extracted: 6,
        relationships_created: 2,
      }),
    );
    const result = await deyta.memory.rememberBatch({
      external_reference_id: "user-abc",
      documents: [{ content: "a" }, { content: "b" }, { content: "c" }],
    });
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(1);
    expect(result.processed + result.skipped + result.failed).toBe(result.total);
    expect((mock.requests[0]?.body as Record<string, unknown>).external_reference_id).toBe(
      "user-abc",
    );
  });

  test("rejects an empty document array before sending a request", async () => {
    const { deyta, mock } = setup();
    await expect(
      deyta.memory.rememberBatch({ namespace_id: "ns_1", documents: [] }),
    ).rejects.toMatchObject({ name: "DeytaError", code: "BAD_REQUEST", status: 400 });
    expect(mock.requests.length).toBe(0);
  });

  test("rejects more than the max documents before sending a request", async () => {
    const { deyta, mock } = setup();
    const documents = Array.from({ length: REMEMBER_BATCH_MAX_DOCUMENTS + 1 }, (_, i) => ({
      content: `doc ${i}`,
    }));
    await expect(deyta.memory.rememberBatch({ namespace_id: "ns_1", documents })).rejects.toBeInstanceOf(
      DeytaError,
    );
    expect(mock.requests.length).toBe(0);
  });

  test("accepts exactly the max documents", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({ ...aggregate, total: REMEMBER_BATCH_MAX_DOCUMENTS, processed: REMEMBER_BATCH_MAX_DOCUMENTS }),
    );
    const documents = Array.from({ length: REMEMBER_BATCH_MAX_DOCUMENTS }, (_, i) => ({
      content: `doc ${i}`,
    }));
    const result = await deyta.memory.rememberBatch({ namespace_id: "ns_1", documents });
    expect(result.total).toBe(REMEMBER_BATCH_MAX_DOCUMENTS);
    expect(mock.requests.length).toBe(1);
  });
});

describe("Memory.recall", () => {
  test("translates from/until Date to start_time/end_time ISO strings", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        query: "meetings",
        namespace_id: "ns_1",
        documents: [],
        chunks: [],
        entities: [],
        relationships: [],
        usage: [],
      }),
    );
    const from = new Date("2026-04-01T00:00:00.000Z");
    const until = new Date("2026-04-30T23:59:59.000Z");
    await deyta.memory.recall({
      namespace_id: "ns_1",
      query: "meetings",
      from,
      until,
    });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.start_time).toBe(from.toISOString());
    expect(body.end_time).toBe(until.toISOString());
    expect("from" in body).toBe(false);
    expect("until" in body).toBe(false);
  });

  test("accepts ISO strings directly", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        query: "meetings",
        namespace_id: "ns_1",
        documents: [],
        chunks: [],
        entities: [],
        relationships: [],
        usage: [],
      }),
    );
    await deyta.memory.recall({
      namespace_id: "ns_1",
      query: "meetings",
      from: "2026-04-01T00:00:00Z",
    });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.start_time).toBe("2026-04-01T00:00:00Z");
    expect(body.end_time).toBeUndefined();
  });

  test("works without time bounds", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        query: "anything",
        namespace_id: "ns_1",
        documents: [
          {
            id: "d1",
            source_type: "api",
            created_at: "2026-04-01T00:00:00Z",
            title: "t",
            external_id: null,
            source: "s",
            source_name: null,
            source_url: null,
            content_type: null,
            source_timestamp: "2026-04-01T00:00:00Z",
            metadata: {},
          },
        ],
        chunks: [
          {
            id: "c1",
            document_id: "d1",
            content: "a",
            score: 0.9,
            created_at: "2026-04-01T00:00:00Z",
            occurred_at: "2026-04-01T00:00:00Z",
            connected_entity_ids: [],
            chunker_info: { chunker: "semantic" },
          },
        ],
        entities: [],
        relationships: [],
        usage: [],
      }),
    );
    const result = await deyta.memory.recall({
      external_reference_id: "user-abc",
      query: "anything",
    });
    expect(result.chunks.length).toBe(1);
    expect(result.documents.length).toBe(1);
    expect(result.documents[0]?.id).toBe("d1");
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.external_reference_id).toBe("user-abc");
  });
});

describe("Memory.ask", () => {
  test("translates from/until and returns the normalized AskResult", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        answer_id: "run_1",
        answer: "yes",
        sources: [
          {
            id: "doc_1",
            title: "Release notes",
            source: "nango://granola/transcripts",
            source_type: "connection",
            source_name: "granola",
            source_url: "https://granola.so/notes/abc",
            external_id: "abc",
            content_type: "text/plain",
            created_at: "2026-04-23T14:00:00Z",
            source_timestamp: null,
          },
        ],
        usage: {
          input_tokens: 100,
          output_tokens: 5,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: 105,
          requests: 1,
          by_source: [
            {
              source: "ask_agent",
              model: "openai:gpt-4o",
              input_tokens: 100,
              output_tokens: 5,
              cache_read_tokens: 0,
              cache_write_tokens: 0,
              requests: 1,
              total_tokens: 105,
              timestamp: "2026-04-23T14:00:01Z",
            },
          ],
        },
        timing: {
          started_at: "2026-04-23T14:00:00Z",
          finished_at: "2026-04-23T14:00:02Z",
          duration_ms: 2000,
        },
      }),
    );
    const result = await deyta.memory.ask({
      namespace_id: "ns_1",
      query: "is it ready?",
      from: new Date("2026-04-01T00:00:00Z"),
      config: { max_recall_limit: 10 },
    });
    expect(result.answer).toBe("yes");
    expect(result.answer_id).toBe("run_1");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.title).toBe("Release notes");
    expect(result.usage.total_tokens).toBe(105);
    expect(result.timing.duration_ms).toBe(2000);
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.start_time).toBe("2026-04-01T00:00:00.000Z");
    expect(body.config).toEqual({ max_recall_limit: 10 });
  });
});

describe("Memory.forget", () => {
  test("posts to /forget with document_id", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk({ document_id: "doc_1", deleted: true }));
    const result = await deyta.memory.forget({
      namespace_id: "ns_1",
      document_id: "doc_1",
    });
    expect(result.deleted).toBe(true);
    expect(mock.requests[0]?.url).toMatch(/\/forget$/);
    expect(mock.requests[0]?.body).toEqual({
      namespace_id: "ns_1",
      document_id: "doc_1",
    });
  });
});
