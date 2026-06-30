import { describe, test, expect } from "bun:test";
import { Deyta } from "../src/index.js";
import { FetchMock, jsonOk, sseOk } from "./_fetch-mock.js";

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
    expect(mock.requests[0]?.url).toMatch(/\/api\/v1\/remember$/);
    expect(mock.requests[0]?.method).toBe("POST");
    expect(mock.requests[0]?.body).toMatchObject({
      namespace_id: "ns_1",
      content: "hello world",
      title: "greeting",
    });
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
      external_id: "user-abc",
      query: "anything",
    });
    expect(result.chunks.length).toBe(1);
    expect(result.documents.length).toBe(1);
    expect(result.documents[0]?.id).toBe("d1");
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.external_id).toBe("user-abc");
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

describe("Memory.rememberBatch", () => {
  test("posts to /remember-batch and returns the result event", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      sseOk([
        { type: "progress", processed: 0, total: 2 },
        { type: "progress", processed: 1, total: 2 },
        {
          type: "result",
          total: 2,
          processed: 2,
          skipped: 0,
          failed: 0,
          chunks: 4,
          entities: 3,
          relationships: 1,
          documents: [
            { document_id: "doc_1", chunks_created: 2, entities_extracted: 2, relationships_created: 1, status: "ok" },
            { document_id: "doc_2", chunks_created: 2, entities_extracted: 1, relationships_created: 0, status: "ok" },
          ],
        },
      ]),
    );
    const result = await deyta.memory.rememberBatch({
      namespace_id: "ns_1",
      documents: [
        { content: "doc one" },
        { content: "doc two" },
      ],
    });
    expect(result.total).toBe(2);
    expect(result.processed).toBe(2);
    expect(result.chunks).toBe(4);
    expect(result.documents).toHaveLength(2);
    expect(mock.requests[0]?.url).toMatch(/\/api\/v1\/remember-batch$/);
    expect(mock.requests[0]?.method).toBe("POST");
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.namespace_id).toBe("ns_1");
  });

  test("calls onProgress for each SSE event", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      sseOk([
        { type: "progress", processed: 0, total: 1 },
        { type: "status", level: "INFO", message: "extracting" },
        {
          type: "result",
          total: 1, processed: 1, skipped: 0, failed: 0,
          chunks: 1, entities: 0, relationships: 0, documents: [],
        },
      ]),
    );
    const events: unknown[] = [];
    await deyta.memory.rememberBatch(
      { namespace_id: "ns_1", documents: [{ content: "hello" }] },
      { onProgress: (e) => events.push(e) },
    );
    expect(events).toHaveLength(3);
    expect((events[0] as { type: string }).type).toBe("progress");
    expect((events[1] as { type: string }).type).toBe("status");
    expect((events[2] as { type: string }).type).toBe("result");
  });

  test("throws DeytaError on SSE error event", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      sseOk([
        { type: "progress", processed: 0, total: 1 },
        { type: "error", detail: "namespace not found" },
      ]),
    );
    await expect(
      deyta.memory.rememberBatch({
        namespace_id: "ns_1",
        documents: [{ content: "hello" }],
      }),
    ).rejects.toThrow("namespace not found");
  });

  test("throws DeytaError when stream ends without result", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      sseOk([
        { type: "progress", processed: 0, total: 1 },
      ]),
    );
    await expect(
      deyta.memory.rememberBatch({
        namespace_id: "ns_1",
        documents: [{ content: "hello" }],
      }),
    ).rejects.toThrow("Stream ended without a result event");
  });

  test("sends ontology_id, entity_types, and relationship_types", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      sseOk([{
        type: "result",
        total: 1, processed: 1, skipped: 0, failed: 0,
        chunks: 1, entities: 1, relationships: 0, documents: [],
      }]),
    );
    await deyta.memory.rememberBatch({
      namespace_id: "ns_1",
      documents: [{ content: "hello" }],
      ontology_id: "onto_1",
      entity_types: ["person"],
      relationship_types: ["knows"],
    });
    const body = mock.requests[0]?.body as Record<string, unknown>;
    expect(body.ontology_id).toBe("onto_1");
    expect(body.entity_types).toEqual(["person"]);
    expect(body.relationship_types).toEqual(["knows"]);
  });

  test("sends Accept: text/event-stream header", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      sseOk([{
        type: "result",
        total: 0, processed: 0, skipped: 0, failed: 0,
        chunks: 0, entities: 0, relationships: 0, documents: [],
      }]),
    );
    await deyta.memory.rememberBatch({
      namespace_id: "ns_1",
      documents: [],
    });
    expect(mock.requests[0]?.headers.get("Accept")).toBe("text/event-stream");
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
