import type { PaginatedResult } from "./client.js";

export interface IterateParams {
  /** Items per request. Defaults to the API default (50). */
  limit?: number;
}

/**
 * Generic cursor-walker. Yields each item from the first page onward,
 * following `next_cursor` until `has_more` is false.
 */
export async function* paginate<T>(
  fetchPage: (cursor: string | null) => Promise<PaginatedResult<T>>,
): AsyncGenerator<T, void, void> {
  let cursor: string | null = null;
  while (true) {
    const { data, pagination } = await fetchPage(cursor);
    for (const item of data) yield item;
    if (!pagination.has_more || !pagination.next_cursor) return;
    cursor = pagination.next_cursor;
  }
}
