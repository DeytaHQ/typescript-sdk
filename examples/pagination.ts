/**
 * Pagination — walk every namespace via the async iterator.
 *
 * Run with:
 *   DEYTA_API_KEY=… bun run examples/pagination.ts
 */
import { Deyta } from "../src/index.js";

const apiKey = process.env.DEYTA_API_KEY;
if (!apiKey) {
  console.error("Set DEYTA_API_KEY before running this example.");
  process.exit(1);
}

const deyta = new Deyta({ apiKey });

// Manual pagination — one page at a time.
const firstPage = await deyta.namespaces.list({ page: 1, page_size: 20 });
console.log(
  `Page 1: ${firstPage.data.length} of ${firstPage.pagination.total} total ` +
    `(${firstPage.pagination.totalPages} pages).`,
);

// Auto-pagination — yields every namespace across all pages.
let count = 0;
for await (const ns of deyta.namespaces.iterate({ page_size: 50 })) {
  count++;
  if (count <= 5) console.log(` - ${ns.id} (${ns.name})`);
}
console.log(`Iterated ${count} namespaces.`);
