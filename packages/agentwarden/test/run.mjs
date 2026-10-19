// Bundles a test (default test/e2e.ts; `node test/run.mjs docker` → test/docker.ts) with esbuild
// into node_modules/.cache and runs it with plain node.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
const here = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2] ?? "e2e";
const outDir = join(here, "..", "node_modules", ".cache");
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, `agentwarden-${name}.mjs`);
await build({ entryPoints: [join(here, `${name}.ts`)], bundle: true, platform: "node", format: "esm", outfile, logLevel: "warning",
  external: ["@electric-sql/pglite", "node-sql-parser", "jose", "pg"] });
process.exit(spawnSync(process.execPath, [outfile], { stdio: "inherit" }).status ?? 1);
