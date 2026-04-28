import { describe, test, expect } from "bun:test";
import { Deyta } from "../src/index.js";
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

describe("Memory.recall", () => {
  test("translates from/until Date to start_time/end_time ISO strings", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk({
        query: "meetings",
        namespace_id: "ns_1",
        chunks: [],
        entities: [],
        context_text: "",
        llm_usage: [],
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
        chunks: [],
        entities: [],
        context_text: "",
        llm_usage: [],
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
        chunks: [
          {
            id: "c1",
            document_id: "d1",
            content: "a",
            score: 0.9,
            source: {
              id: "d1",
              source_type: "api",
              created_at: "2026-04-01T00:00:00Z",
              title: "t",
              source: "s",
              source_timestamp: "2026-04-01T00:00:00Z",
            },
            metadata: {},
          },
        ],
        entities: [],
        context_text: "a",
        llm_usage: [],
      }),
    );
    const result = await deyta.memory.recall({
      external_reference_id: "user-abc",
      query: "anything",
    });
    expect(result.chunks.length).toBe(1);
    expect(result.context_text).toBe("a");
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
            source_type: "api",
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
