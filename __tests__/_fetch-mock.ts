export interface RecordedRequest {
  method: string;
  url: string;
  headers: Headers;
  body?: unknown;
}

export type Handler = (req: Request) => Promise<Response> | Response;

export class FetchMock {
  requests: RecordedRequest[] = [];
  private handler: Handler = () => {
    throw new Error("FetchMock: no handler registered");
  };

  setHandler(h: Handler) {
    this.handler = h;
  }

  fetch: typeof fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input.toString(), init);
    let body: unknown;
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
      const text = await req.clone().text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
    }
    this.requests.push({ method: req.method, url: req.url, headers: req.headers, body });
    return this.handler(req);
  };
}

export function jsonOk<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonPaginated<T>(data: T[], pagination: { has_more: boolean; next_cursor: string | null }): Response {
  return new Response(JSON.stringify({ success: true, data, has_more: pagination.has_more, next_cursor: pagination.next_cursor }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(status: number, code: string, message: string, headers?: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code, message, status } }),
    {
      status,
      headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    },
  );
}

export function noBody(status = 204): Response {
  return new Response(null, { status });
}
