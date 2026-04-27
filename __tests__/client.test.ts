import { describe, test, expect } from "bun:test";
import { Deyta, DeytaError, DeytaConnectionError, SDK_VERSION } from "../src/index.js";
import { FetchMock, jsonOk, jsonError } from "./_fetch-mock.js";

function setup(overrides: Parameters<typeof Deyta>[0] extends infer C ? Partial<C> : never = {}) {
  const mock = new FetchMock();
  const deyta = new Deyta({
    apiKey: "test-key",
    fetch: mock.fetch,
    retries: { maxRetries: 2, initialBackoffMs: 1, maxBackoffMs: 5 },
    ...overrides,
  });
  return { deyta, mock };
}

/**
 * Run `fn` with `process.env[key]` set to `value` (or unset when `undefined`),
 * restoring the previous value afterwards. Wraps assertions in `try/finally`
 * so a failure can't leak env mutation into other tests.
 */
async function withEnv(
  key: string,
  value: string | undefined,
  fn: () => Promise<void>,
): Promise<void> {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

describe("HttpClient — request shape", () => {
  test("uses default baseUrl when omitted", async () => {
    await withEnv("DEYTA_BASE_URL", undefined, async () => {
      const { deyta, mock } = setup();
      mock.setHandler(() => jsonOk({ id: "ns_1" }));
      await deyta.namespaces.get("ns_1");
      expect(mock.requests[0]?.url).toBe("https://api.deyta.ai/gateway/v1/namespaces/ns_1");
    });
  });

  test("falls back to DEYTA_BASE_URL when baseUrl omitted", async () => {
    await withEnv("DEYTA_BASE_URL", "https://console.deyta.ai", async () => {
      const { deyta, mock } = setup();
      mock.setHandler(() => jsonOk({ id: "ns_1" }));
      await deyta.namespaces.get("ns_1");
      expect(mock.requests[0]?.url).toBe(
        "https://console.deyta.ai/gateway/v1/namespaces/ns_1",
      );
    });
  });

  test("explicit baseUrl beats DEYTA_BASE_URL", async () => {
    await withEnv("DEYTA_BASE_URL", "https://console.deyta.ai", async () => {
      const mock = new FetchMock();
      const deyta = new Deyta({
        apiKey: "k",
        baseUrl: "https://staging.deyta.ai",
        fetch: mock.fetch,
      });
      mock.setHandler(() => jsonOk({ id: "x" }));
      await deyta.namespaces.get("x");
      expect(mock.requests[0]?.url).toBe(
        "https://staging.deyta.ai/gateway/v1/namespaces/x",
      );
    });
  });

  test("warns and falls back to default when DEYTA_BASE_URL is whitespace", async () => {
    await withEnv("DEYTA_BASE_URL", "   ", async () => {
      const warnings: unknown[][] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(args);
      };
      try {
        const { deyta, mock } = setup();
        mock.setHandler(() => jsonOk({ id: "ns_1" }));
        await deyta.namespaces.get("ns_1");
        expect(mock.requests[0]?.url).toBe(
          "https://api.deyta.ai/gateway/v1/namespaces/ns_1",
        );
        expect(warnings).toHaveLength(1);
        expect(String(warnings[0]?.[0])).toContain("DEYTA_BASE_URL");
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  test("trims surrounding whitespace from DEYTA_BASE_URL", async () => {
    await withEnv("DEYTA_BASE_URL", "  https://staging.deyta.ai  ", async () => {
      const { deyta, mock } = setup();
      mock.setHandler(() => jsonOk({ id: "ns_1" }));
      await deyta.namespaces.get("ns_1");
      expect(mock.requests[0]?.url).toBe(
        "https://staging.deyta.ai/gateway/v1/namespaces/ns_1",
      );
    });
  });

  test("respects explicit baseUrl override", async () => {
    const mock = new FetchMock();
    const deyta = new Deyta({
      apiKey: "k",
      baseUrl: "https://staging.deyta.ai",
      fetch: mock.fetch,
    });
    mock.setHandler(() => jsonOk({ id: "ns_1" }));
    await deyta.namespaces.get("ns_1");
    expect(mock.requests[0]?.url).toBe("https://staging.deyta.ai/gateway/v1/namespaces/ns_1");
  });

  test("strips trailing slashes from baseUrl", async () => {
    const mock = new FetchMock();
    const deyta = new Deyta({
      apiKey: "k",
      baseUrl: "https://api.deyta.ai///",
      fetch: mock.fetch,
    });
    mock.setHandler(() => jsonOk({ id: "x" }));
    await deyta.namespaces.get("x");
    expect(mock.requests[0]?.url).toBe("https://api.deyta.ai/gateway/v1/namespaces/x");
  });

  test("sends Authorization, User-Agent, Accept headers on every request", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk({ id: "x" }));
    await deyta.namespaces.get("x");
    const headers = mock.requests[0]!.headers;
    expect(headers.get("authorization")).toBe("Bearer test-key");
    expect(headers.get("user-agent")).toContain(`deyta-sdk/${SDK_VERSION}`);
    expect(headers.get("accept")).toBe("application/json");
  });

  test("merges per-call headers but cannot override Authorization", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk({ id: "x" }));
    await deyta.namespaces.get("x", {
      headers: { "X-Trace-Id": "abc-123", Authorization: "evil" },
    });
    const headers = mock.requests[0]!.headers;
    expect(headers.get("x-trace-id")).toBe("abc-123");
    expect(headers.get("authorization")).toBe("Bearer test-key");
  });

  test("requires apiKey", () => {
    expect(() => new Deyta({ apiKey: "" })).toThrow(/apiKey is required/);
  });
});

describe("HttpClient — response handling", () => {
  test("unwraps success envelope", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk({ id: "ns_1", name: "Hello" }));
    const ns = await deyta.namespaces.get("ns_1");
    expect(ns.id).toBe("ns_1");
    expect(ns.name).toBe("Hello");
  });

  test("throws DeytaError with code, message, status on shaped error", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonError(404, "NOT_FOUND", "Not Found"));
    try {
      await deyta.namespaces.get("missing");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DeytaError);
      const e = err as DeytaError;
      expect(e.code).toBe("NOT_FOUND");
      expect(e.status).toBe(404);
      expect(e.message).toBe("Not Found");
    }
  });

  test("synthesizes DeytaError when error envelope is missing", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      new Response("oops", { status: 500, headers: { "Content-Type": "text/plain" } }),
    );
    try {
      await deyta.namespaces.get("x");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DeytaError);
      const e = err as DeytaError;
      expect(e.status).toBe(500);
      expect(e.code).toBe("INTERNAL_ERROR");
    }
  });

  test("204 from delete returns void", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => new Response(null, { status: 204 }));
    const result = await deyta.namespaces.delete("ns_1");
    expect(result).toBeUndefined();
  });
});

describe("HttpClient — retries", () => {
  test("retries idempotent GET on 503 and succeeds", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls++;
      if (calls < 3) return jsonError(503, "SERVICE_UNAVAILABLE", "down");
      return jsonOk({ id: "ns_1" });
    });
    const ns = await deyta.namespaces.get("ns_1");
    expect(ns.id).toBe("ns_1");
    expect(calls).toBe(3);
  });

  test("does not retry POST automatically", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls++;
      return jsonError(503, "SERVICE_UNAVAILABLE", "down");
    });
    try {
      await deyta.memory.remember({ namespace_id: "ns_1", content: "x" });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DeytaError);
    }
    expect(calls).toBe(1);
  });

  test("does not retry on 4xx", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls++;
      return jsonError(404, "NOT_FOUND", "missing");
    });
    try {
      await deyta.namespaces.get("x");
      throw new Error("expected throw");
    } catch {
      // expected
    }
    expect(calls).toBe(1);
  });

  test("honors Retry-After header (seconds)", async () => {
    const { deyta, mock } = setup({
      retries: { maxRetries: 1, initialBackoffMs: 10_000, maxBackoffMs: 60_000 },
    });
    let calls = 0;
    mock.setHandler(() => {
      calls++;
      if (calls === 1) return jsonError(429, "BAD_REQUEST", "rate limited", { "Retry-After": "0" });
      return jsonOk({ id: "ns_1" });
    });
    const start = Date.now();
    const ns = await deyta.namespaces.get("ns_1");
    const elapsed = Date.now() - start;
    expect(ns.id).toBe("ns_1");
    // Retry-After 0 means we shouldn't wait the configured 10s backoff.
    expect(elapsed).toBeLessThan(1_000);
  });

  test("retries exhaust and surface DeytaError", async () => {
    const { deyta, mock } = setup();
    let calls = 0;
    mock.setHandler(() => {
      calls++;
      return jsonError(503, "SERVICE_UNAVAILABLE", "down");
    });
    try {
      await deyta.namespaces.get("x");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DeytaError);
    }
    expect(calls).toBe(3); // initial + 2 retries
  });
});

describe("HttpClient — timeouts and signals", () => {
  test("caller-aborted signal throws DeytaConnectionError", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(
      () =>
        new Promise<Response>((_resolve, reject) => {
          setTimeout(() => reject(new DOMException("abort", "AbortError")), 100);
        }),
    );
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 5);
    try {
      await deyta.namespaces.get("x", { signal: ctl.signal });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DeytaConnectionError);
      expect((err as DeytaConnectionError).message).toMatch(/abort/i);
    }
  });

  test("per-call timeout fires before global timeout", async () => {
    const mock = new FetchMock();
    const deyta = new Deyta({
      apiKey: "k",
      timeout: 60_000,
      retries: { maxRetries: 0 },
      fetch: mock.fetch,
    });
    mock.setHandler(
      (req) =>
        new Promise<Response>((_resolve, reject) => {
          req.signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const start = Date.now();
    try {
      await deyta.namespaces.get("x", { timeout: 20 });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DeytaConnectionError);
    }
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe("HttpClient — logger", () => {
  test("emits request and response events", async () => {
    const events: string[] = [];
    const mock = new FetchMock();
    const deyta = new Deyta({
      apiKey: "k",
      fetch: mock.fetch,
      logger: (e) => events.push(e.type),
      retries: { maxRetries: 0 },
    });
    mock.setHandler(() => jsonOk({ id: "x" }));
    await deyta.namespaces.get("x");
    expect(events).toContain("request");
    expect(events).toContain("response");
  });
});
