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
  test("translates from/until and returns the ask event stream", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonOk([
        { type: "RUN_STARTED", threadId: "t1", runId: "r1" },
        {
          type: "TEXT_MESSAGE_START",
          timestamp: 1,
          messageId: "m1",
          role: "assistant",
        },
        { type: "TEXT_MESSAGE_CONTENT", timestamp: 2, messageId: "m1", delta: "ye" },
        { type: "TEXT_MESSAGE_CONTENT", timestamp: 3, messageId: "m1", delta: "s" },
        { type: "TEXT_MESSAGE_END", timestamp: 4, messageId: "m1" },
        { type: "RUN_FINISHED", threadId: "t1", runId: "r1" },
      ]),
    );
    const result = await deyta.memory.ask({
      namespace_id: "ns_1",
      query: "is it ready?",
      from: new Date("2026-04-01T00:00:00Z"),
      config: { max_recall_limit: 10 },
    });
    const answer = result
      .filter((e) => e.type === "TEXT_MESSAGE_CONTENT")
      .map((e) => e.delta)
      .join("");
    expect(answer).toBe("yes");
    expect(result[0]?.type).toBe("RUN_STARTED");
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
