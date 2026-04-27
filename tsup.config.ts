import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
  },
});
