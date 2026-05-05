/**
 * Smoke test the personas resource: create, get, getByExternalRef, update,
 * list, status, getSummary, delete. The async build endpoint is exercised
 * behind `--build` since builds may take minutes to complete; likewise
 * `generateSummary` is exercised behind `--summary` because it triggers an
 * upstream LLM call that can take seconds.
 *
 * The status endpoint is asserted in three states (pre-build, post-build
 * trigger, post-summary) — the shape check covers the readiness block
 * (`summary.available`, `summary.generated_at`, `summary.persona_built_at`)
 * added in the gateway response, and the per-state checks confirm the
 * expected transitions across the persona lifecycle.
 *
 * Run: DEYTA_API_KEY=… bun run scripts/smoke/personas.ts
 *      DEYTA_API_KEY=… bun run scripts/smoke/personas.ts --build
 *      DEYTA_API_KEY=… bun run scripts/smoke/personas.ts --summary
 */
import { DeytaError } from "../../src/index.js";
import type { PersonaBuildStatus } from "../../src/index.js";
import { expectedFailure, makeClient, runSmoke, step, uniq } from "./_shared.js";

const triggerBuild = process.argv.includes("--build");
const triggerSummary = process.argv.includes("--summary");

const STATUS_VALUES = ["queued", "building", "ready", "not_built"] as const;

function assertStatusShape(s: PersonaBuildStatus, label: string): void {
  if (!(STATUS_VALUES as readonly string[]).includes(s.status)) {
    throw new Error(`${label}: unexpected status value "${s.status}"`);
  }
  if (s.last_built_at !== null && typeof s.last_built_at !== "string") {
    throw new Error(`${label}: last_built_at must be string|null`);
  }
  if (!s.summary || typeof s.summary.available !== "boolean") {
    throw new Error(`${label}: missing summary.available boolean`);
  }
  if (s.summary.available) {
    if (typeof s.summary.generated_at !== "string") {
      throw new Error(`${label}: summary.generated_at must be string when available`);
    }
    // persona_built_at may still be null on legacy rows even when available.
    if (
      s.summary.persona_built_at !== null &&
      typeof s.summary.persona_built_at !== "string"
    ) {
      throw new Error(`${label}: summary.persona_built_at must be string|null`);
    }
  } else {
    if (s.summary.generated_at !== null) {
      throw new Error(`${label}: summary.generated_at must be null when !available`);
    }
    if (s.summary.persona_built_at !== null) {
      throw new Error(`${label}: summary.persona_built_at must be null when !available`);
    }
  }
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
    console.log(
      "  summary.available:",
      status.summary.available,
      "summary.generated_at:",
      status.summary.generated_at,
    );
    assertStatusShape(status, "status (pre-build)");
    // A freshly-created persona has never been built and has no summary.
    if (status.status !== "not_built") {
      throw new Error(
        `status (pre-build): expected "not_built" on a fresh persona, got "${status.status}"`,
      );
    }
    if (status.last_built_at !== null) {
      throw new Error("status (pre-build): expected last_built_at to be null on a fresh persona");
    }
    if (status.summary.available) {
      throw new Error(
        "status (pre-build): expected summary.available=false on a fresh persona",
      );
    }

    if (triggerBuild) {
      step("build (async — not awaited to completion)");
      const accepted = await deyta.personas.build(persona.id);
      console.log("  build_id:", accepted.build_id, "status:", accepted.status);

      step("status (post-build trigger)");
      const postBuild = await deyta.personas.status(persona.id);
      console.log(
        "  status:",
        postBuild.status,
        "last_built_at:",
        postBuild.last_built_at,
      );
      assertStatusShape(postBuild, "status (post-build trigger)");
      // The build may still be queued, in flight, or already complete by the
      // time we re-poll. `not_built` would indicate the trigger was lost.
      if (postBuild.status === "not_built") {
        throw new Error(
          'status (post-build trigger): expected "queued" | "building" | "ready" after build, got "not_built"',
        );
      }
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
      step("generateSummary (upstream LLM call — may take several seconds)");
      const summary = await deyta.personas.generateSummary(persona.id, {
        temperature: 0.2,
      });
      console.log("  generated_at:", summary.generated_at);
      console.log("  persona_built_at:", summary.persona_built_at);
      console.log("  preview:", summary.summary.slice(0, 120));

      step("getSummary (post-generation — expects 200)");
      const persisted = await deyta.personas.getSummary(persona.id);
      console.log("  matches:", persisted.generated_at === summary.generated_at);

      step("status (post-summary)");
      const postSummary = await deyta.personas.status(persona.id);
      console.log(
        "  status:",
        postSummary.status,
        "summary.available:",
        postSummary.summary.available,
        "summary.generated_at:",
        postSummary.summary.generated_at,
      );
      assertStatusShape(postSummary, "status (post-summary)");
      if (!postSummary.summary.available) {
        throw new Error(
          "status (post-summary): expected summary.available=true after generateSummary",
        );
      }
      if (postSummary.summary.generated_at !== summary.generated_at) {
        throw new Error(
          `status (post-summary): summary.generated_at "${postSummary.summary.generated_at}" does not match the just-generated "${summary.generated_at}"`,
        );
      }
    } else {
      console.log("  (skipping generateSummary — pass --summary to trigger)");
    }
  } finally {
    step("delete persona (cleanup)");
    await deyta.personas.delete(persona.id);
    console.log("  deleted:", persona.id);
  }
});
