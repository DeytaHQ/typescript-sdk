import { describe, test, expect } from "bun:test";
import { Deyta, DeytaError } from "../src/index.js";
import type { FieldError } from "../src/index.js";
import { FetchMock, jsonOk, jsonError } from "./_fetch-mock.js";

function setup() {
  const mock = new FetchMock();
  const deyta = new Deyta({
    apiKey: "k",
    fetch: mock.fetch,
    retries: { maxRetries: 0 },
  });
  return { deyta, mock };
}

describe("filter error decode", () => {
  test("populates code, status, and errors from a field-validation envelope", async () => {
    const { deyta, mock } = setup();
    const fieldErrors: FieldError[] = [
      {
        path: "filter.occurred_at",
        code: "CONFLICT",
        message: "occurred_at is constrained by both the filter and the time range",
        allowed: null,
      },
    ];
    mock.setHandler(() =>
      jsonError(
        400,
        "FILTER_TIME_PARAMS_CONFLICT",
        "filter conflicts with the supplied time range",
        fieldErrors,
      ),
    );
    try {
      await deyta.memory.recall({
        namespace_id: "ns_1",
        query: "q",
        from: new Date("2026-01-01T00:00:00Z"),
        filter: { occurred_at: { $gte: "2026-02-01T00:00:00Z" } },
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DeytaError);
      const e = err as DeytaError;
      expect(e.code).toBe("FILTER_TIME_PARAMS_CONFLICT");
      expect(e.status).toBe(400);
      expect(e.message).toBe("filter conflicts with the supplied time range");
      // The per-field errors array is surfaced verbatim.
      expect(e.errors).toEqual(fieldErrors);
    }
  });

  test("carries multiple field errors through unchanged", async () => {
    const { deyta, mock } = setup();
    const fieldErrors: FieldError[] = [
      { path: "filter.occurred_at", code: "CONFLICT", message: "conflict", allowed: null },
      {
        path: "filter.source_type",
        code: "INVALID_ENUM",
        message: "unknown source_type",
        allowed: ["api", "connection", "file"],
      },
    ];
    mock.setHandler(() =>
      jsonError(400, "BAD_REQUEST", "invalid filter", fieldErrors),
    );
    try {
      await deyta.memory.ask({ namespace_id: "ns_1", query: "q" });
      throw new Error("expected throw");
    } catch (err) {
      const e = err as DeytaError;
      expect(e.errors).toEqual(fieldErrors);
      expect(e.errors?.[1]?.allowed).toEqual(["api", "connection", "file"]);
    }
  });

  test("leaves errors undefined when the envelope carries none", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() =>
      jsonError(400, "BAD_REQUEST", "plain bad request"),
    );
    try {
      await deyta.memory.recall({ namespace_id: "ns_1", query: "q" });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DeytaError);
      const e = err as DeytaError;
      expect(e.code).toBe("BAD_REQUEST");
      expect(e.status).toBe(400);
      expect(e.errors).toBeUndefined();
    }
  });

  test("threads field errors through on a non-memory endpoint too", async () => {
    // Confirms the field-error decode isn't specific to recall/ask: any endpoint
    // returning the envelope surfaces `errors` on the thrown DeytaError.
    const { deyta, mock } = setup();
    const fieldErrors: FieldError[] = [
      { path: "name", code: "REQUIRED", message: "name is required", allowed: null },
    ];
    mock.setHandler(() =>
      jsonError(400, "BAD_REQUEST", "validation failed", fieldErrors),
    );
    try {
      await deyta.namespaces.create({ name: "" });
      throw new Error("expected throw");
    } catch (err) {
      const e = err as DeytaError;
      expect(e.errors).toEqual(fieldErrors);
    }
  });

  test("success envelope is unaffected by the errors field", async () => {
    const { deyta, mock } = setup();
    mock.setHandler(() => jsonOk({ id: "ns_1", name: "ok" }));
    const ns = await deyta.namespaces.get("ns_1");
    expect(ns.id).toBe("ns_1");
  });
});
