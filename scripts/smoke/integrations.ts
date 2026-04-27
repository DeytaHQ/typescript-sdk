/**
 * Smoke test the read-only surfaces of the integrations resource:
 * listProviders and listConnections (scoped to a throwaway namespace).
 *
 * The OAuth-mutating endpoints (startConnection / completeConnection) are
 * intentionally skipped — they require an interactive browser flow.
 *
 * Run: DEYTA_API_KEY=… bun run scripts/smoke/integrations.ts
 */
import { makeClient, runSmoke, step, uniq } from "./_shared.js";

await runSmoke("integrations", async () => {
  const deyta = makeClient();

  step("listProviders");
  const providers = await deyta.integrations.listProviders();
  console.log("  count:", providers.length);
  for (const p of providers.slice(0, 3)) {
    console.log("  -", p.provider, "enabled:", p.enabled);
  }

  step("create scratch namespace");
  const ns = await deyta.namespaces.create({
    name: uniq("Smoke — integrations"),
    description: "Created by scripts/smoke/integrations.ts",
  });
  console.log("  namespace:", ns.id);

  try {
    step("listConnections (empty for fresh namespace)");
    const conns = await deyta.integrations.listConnections({
      type: "namespace",
      id: ns.id,
    });
    console.log("  count:", conns.length);
  } finally {
    step("delete scratch namespace (cleanup)");
    await deyta.namespaces.delete(ns.id);
    console.log("  deleted:", ns.id);
  }
});
