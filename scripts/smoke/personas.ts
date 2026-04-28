/**
 * Smoke test the personas resource: create, get, getByExternalRef, update,
 * list, status, getSummary, delete. The async build endpoint is exercised
 * behind `--build` since builds may take minutes to complete; likewise
 * `generateSummary` is exercised behind `--summary` because it triggers an
 * upstream LLM call that can take seconds.
 *
 * Run: DEYTA_API_KEY=… bun run scripts/smoke/personas.ts
 *      DEYTA_API_KEY=… bun run scripts/smoke/personas.ts --build
 *      DEYTA_API_KEY=… bun run scripts/smoke/personas.ts --summary
 */
import { DeytaError } from "../../src/index.js";
import { expectedFailure, makeClient, runSmoke, step, uniq } from "./_shared.js";

const triggerBuild = process.argv.includes("--build");
const triggerSummary = process.argv.includes("--summary");

await runSmoke("personas", async () => {
  const deyta = makeClient();
  const externalRef = uniq("smoke-persona");

  step("create persona");
  const persona = await deyta.personas.create({
    subject: "Smoke test subject",
    description: "Created by scripts/smoke/personas.ts",
    external_reference_id: externalRef,
  });
  console.log("  id:", persona.id, "namespace_id:", persona.namespace_id);

  try {
    step("get by id");
    const fetched = await deyta.personas.get(persona.id);
    console.log("  built:", fetched.built);

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

    step("getSummary (pre-generation — expects 404)");
    try {
      const existing = await deyta.personas.getSummary(persona.id);
      console.warn("  ⚠ unexpected: a fresh persona already has a summary");
      console.warn("  generated_at:", existing.generated_at);
    } catch (err) {
      if (err instanceof DeytaError && err.code === "NOT_FOUND") {
        expectedFailure();
        console.log("  (no summary yet — got NOT_FOUND as expected)");
      } else {
        throw err;
      }
    }

    if (triggerSummary) {
      step("generateSummary (calls Digor — may take several seconds)");
      const summary = await deyta.personas.generateSummary(persona.id, {
        temperature: 0.2,
      });
      console.log("  generated_at:", summary.generated_at);
      console.log("  persona_built_at:", summary.persona_built_at);
      console.log("  preview:", summary.summary.slice(0, 120));

      step("getSummary (post-generation — expects 200)");
      const persisted = await deyta.personas.getSummary(persona.id);
      console.log("  matches:", persisted.generated_at === summary.generated_at);
    } else {
      console.log("  (skipping generateSummary — pass --summary to trigger)");
    }
  } finally {
    step("delete persona (cleanup)");
    await deyta.personas.delete(persona.id);
    console.log("  deleted:", persona.id);
  }
});
