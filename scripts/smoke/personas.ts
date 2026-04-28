/**
 * Smoke test the personas resource: create, get, getByExternalRef, update,
 * list, status, getSummary. The async build endpoint is exercised behind
 * `--build` since builds may take minutes to complete; likewise
 * `generateSummary` is exercised behind `--summary` because it triggers an
 * upstream LLM call that can take seconds.
 *
 * No cleanup: created personas are left behind for inspection. Delete
 * them manually with `deyta.personas.delete(id)` if needed.
 *
 * Run: DEYTA_API_KEY=… bun run scripts/smoke/personas.ts
 *      DEYTA_API_KEY=… bun run scripts/smoke/personas.ts --build
 *      DEYTA_API_KEY=… bun run scripts/smoke/personas.ts --summary
 */
import { DeytaError } from "../../src/index.js";
import { makeClient, preview, runSmoke, step, uniq } from "./_shared.js";

const triggerBuild = process.argv.includes("--build");
const triggerSummary = process.argv.includes("--summary");

function logResponse(value: unknown): void {
  console.log("  response:", preview(value));
}

await runSmoke("personas", async () => {
  const deyta = makeClient();
  const externalRef = uniq("smoke-persona");

  step("create persona");
  const persona = await deyta.personas.create({
    subject: "Smoke test subject",
    description: "Created by scripts/smoke/personas.ts",
    external_reference_id: externalRef,
  });
  logResponse(persona);

  step("get by id");
  const fetched = await deyta.personas.get(persona.id);
  logResponse(fetched);

  step("get by external_reference_id");
  const byRef = await deyta.personas.getByExternalRef(externalRef);
  logResponse(byRef);

  step("update description");
  const updated = await deyta.personas.update(persona.id, {
    description: "Updated by smoke run",
  });
  logResponse(updated);

  step("list page 1");
  const page = await deyta.personas.list({ page: 1, page_size: 5 });
  logResponse(page);

  step("status (pre-build)");
  const status = await deyta.personas.status(persona.id);
  logResponse(status);

  if (triggerBuild) {
    step("build (async — not awaited to completion)");
    const accepted = await deyta.personas.build(persona.id);
    logResponse(accepted);
  } else {
    console.log("  (skipping build — pass --build to trigger)");
  }

  step("getSummary (pre-generation — expects 404)");
  try {
    const existing = await deyta.personas.getSummary(persona.id);
    console.warn("  ⚠ unexpected: a fresh persona already has a summary");
    logResponse(existing);
  } catch (err) {
    if (err instanceof DeytaError && err.code === "NOT_FOUND") {
      console.log("  response: <DeytaError NOT_FOUND 404> (expected)");
    } else {
      throw err;
    }
  }

  if (triggerSummary) {
    step("generateSummary (calls Digor — may take several seconds)");
    const summary = await deyta.personas.generateSummary(persona.id, {
      temperature: 0.2,
    });
    logResponse(summary);

    step("getSummary (post-generation — expects 200)");
    const persisted = await deyta.personas.getSummary(persona.id);
    logResponse(persisted);
  } else {
    console.log("  (skipping generateSummary — pass --summary to trigger)");
  }

  console.log(`\n  (persona ${persona.id} left behind — delete manually if needed)`);
});
