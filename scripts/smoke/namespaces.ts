/**
 * Smoke test the namespaces resource: create, get, getByExternalRef,
 * list, iterate, delete.
 *
 * Run: DEYTA_API_KEY=… bun run scripts/smoke/namespaces.ts
 */
import { makeClient, runSmoke, step, uniq } from "./_shared.js";

await runSmoke("namespaces", async () => {
  const deyta = makeClient();
  const externalRef = uniq("smoke-ns");

  step("create namespace");
  const ns = await deyta.namespaces.create({
    name: "Smoke — namespaces",
    description: "Created by scripts/smoke/namespaces.ts",
    external_reference_id: externalRef,
  });
  console.log("  id:", ns.id, "external_ref:", ns.external_reference_id);

  try {
    step("get by id");
    const fetched = await deyta.namespaces.get(ns.id);
    console.log("  name:", fetched.name);

    step("get by external_reference_id");
    const fetchedByRef = await deyta.namespaces.getByExternalRef(externalRef);
    console.log("  id matches:", fetchedByRef.id === ns.id);

    step("list page 1");
    const page = await deyta.namespaces.list({ page: 1, page_size: 5 });
    console.log("  page items:", page.data.length, "total:", page.pagination.total);

    step("iterate first 3");
    let count = 0;
    for await (const item of deyta.namespaces.iterate({ page_size: 5 })) {
      count += 1;
      if (count >= 3) break;
      console.log("  -", item.id, item.name);
    }
  } finally {
    step("delete namespace (cleanup)");
    await deyta.namespaces.delete(ns.id);
    console.log("  deleted:", ns.id);
  }
});
