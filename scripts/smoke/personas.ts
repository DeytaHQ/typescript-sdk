/**
 * Smoke test the personas resource: create, get, getByExternalRef, update,
 * list, status, delete. The async build endpoint is exercised behind
 * `--build` since builds may take minutes to complete.
 *
 * Run: DEYTA_API_KEY=… bun run scripts/smoke/personas.ts
 *      DEYTA_API_KEY=… bun run scripts/smoke/personas.ts --build
 */
import { makeClient, runSmoke, step, uniq } from "./_shared.js";

const triggerBuild = process.argv.includes("--build");

await runSmoke("personas", async () => {
  const deyta = makeClient();
  const externalRef = uniq("smoke-persona");

  step("create persona");
  const persona = await deyta.personas.create({
    subject: "Smoke test subject",
    description: "Created by scripts/smoke/personas.ts",
    external_reference_id: externalRef,
  });
  console.log("  id:", persona.id, "namespaceId:", persona.namespaceId);

  try {
    step("get by id");
    const fetched = await deyta.personas.get(persona.id);
    console.log("  composite.available:", fetched.composite.available);

    step("get by external_reference_id");
    const byRef = await deyta.personas.getByExternalRef(externalRef);
    console.log("  id matches:", byRef.id === persona.id);

    step("update description");
    const updated = await deyta.personas.update(persona.id, {
      description: "Updated by smoke run",
    });
    console.log("  description:", updated.description);

    step("list page 1");
    const page = await deyta.personas.list({ page: 1, page_size: 5 });
    console.log("  page items:", page.data.length, "total:", page.pagination.total);

    step("status (pre-build)");
    const status = await deyta.personas.status(persona.id);
    console.log("  status:", status.status, "last_built_at:", status.last_built_at);

    if (triggerBuild) {
      step("build (async — not awaited to completion)");
      const accepted = await deyta.personas.build(persona.id);
      console.log("  build_id:", accepted.build_id, "status:", accepted.status);
    } else {
      console.log("  (skipping build — pass --build to trigger)");
    }
  } finally {
    step("delete persona (cleanup)");
    await deyta.personas.delete(persona.id);
    console.log("  deleted:", persona.id);
  }
});
