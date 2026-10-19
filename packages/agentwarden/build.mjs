// Builds the npm package: ESM bundles per entry point (esbuild) + type declarations (tsc).
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
await build({
  entryPoints: { index: "src/index.ts", "gateway/index": "src/gateway/index.ts", "models/index": "src/models/index.ts", "demo/index": "src/demo/index.ts" },
  outdir: "dist",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "node",
  target: "node20",
  external: ["@electric-sql/pglite", "jose", "node-sql-parser", "pg"],
  logLevel: "warning",
});
execSync("npx tsc -p tsconfig.json --emitDeclarationOnly", { stdio: "inherit" });
console.log("built dist/");
