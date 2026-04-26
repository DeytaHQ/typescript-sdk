import type { PaginatedResult } from "./client.js";

export interface IterateParams {
  /** Page size for each underlying request. Defaults to the API default. */
  page_size?: number;
}

/**
 * Generic page-walker. Yields each item from page 1 until the API reports
 * no more pages. The `fetchPage` callback is responsible for producing
 * a `PaginatedResult` for a given page index.
 */
export async function* paginate<T>(
  fetchPage: (page: number) => Promise<PaginatedResult<T>>,
): AsyncGenerator<T, void, void> {
  let page = 1;
  while (true) {
    const { data, pagination } = await fetchPage(page);
    for (const item of data) yield item;
    if (page >= pagination.totalPages || pagination.totalPages === 0) return;
    page += 1;
  }
}
