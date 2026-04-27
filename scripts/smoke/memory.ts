/**
 * Smoke test the memory resource: remember, recall, ask, forget. Uses a
 * throwaway namespace and cleans it up after the run.
 *
 * Run: DEYTA_API_KEY=… bun run scripts/smoke/memory.ts
 */
import { makeClient, runSmoke, step, uniq } from "./_shared.js";

/** Stringify a value for diagnostic logs, capping length so output stays usable. */
function preview(value: unknown, max = 600): string {
  let json: string;
  try {
    json = JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
  if (json === undefined) return String(value);
  return json.length > max ? `${json.slice(0, max)}…` : json;
}

await runSmoke("memory", async () => {
  const deyta = makeClient();

  step("create scratch namespace");
  const ns = await deyta.namespaces.create({
    name: uniq("Smoke — memory"),
    description: "Created by scripts/smoke/memory.ts",
  });
  console.log("  namespace:", ns.id);

  try {
    step("remember");
    const remembered = await deyta.memory.remember({
      namespace_id: ns.id,
      content: "The team standup is every Tuesday at 10am UTC.",
      title: "Standup time",
    });
    console.log("  document_id:", remembered.document_id);
    console.log("  chunks/entities/rels:", remembered.chunks_created, remembered.entities_extracted, remembered.relationships_created);

    step("recall (hybrid)");
    const recalled = await deyta.memory.recall({
      namespace_id: ns.id,
      query: "when is standup?",
      limit: 3,
      mode: "hybrid",
    });
    if (Array.isArray(recalled?.results)) {
      console.log("  matches:", recalled.results.length);
      if (recalled.results[0]) {
        console.log("  top score:", recalled.results[0].score);
      }
    } else {
      console.warn("  ⚠ no `results` array on recall response — gateway shape may have drifted from RecallResult");
      console.warn("  raw recall response:", preview(recalled));
    }

    step("ask");
    const answered = await deyta.memory.ask({
      namespace_id: ns.id,
      query: "When is the team standup?",
    });
    if (typeof answered?.answer === "string") {
      console.log("  answer:", answered.answer.slice(0, 120));
    } else {
      console.warn("  ⚠ no `answer` string on ask response — gateway shape may have drifted from AskResult");
      console.warn("  raw ask response:", preview(answered));
    }

    step("forget");
    const forgotten = await deyta.memory.forget({
      namespace_id: ns.id,
      document_id: remembered.document_id,
    });
    console.log("  deleted:", forgotten.deleted);
  } finally {
    step("delete scratch namespace (cleanup)");
    await deyta.namespaces.delete(ns.id);
    console.log("  deleted:", ns.id);
  }
});
