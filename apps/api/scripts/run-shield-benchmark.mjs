// Bundles shield-benchmark.ts with esbuild into the OS temp dir and runs it with plain node.
// Usage: node apps/api/scripts/run-shield-benchmark.mjs [--refresh] [--json]
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outfile = join(tmpdir(), "capgent-shield-benchmark.mjs");
await build({ entryPoints: [join(here, "shield-benchmark.ts")], bundle: true, platform: "node", format: "esm", outfile, logLevel: "warning" });
const r = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, SHIELD_BENCH_DIR: here } });
process.exit(r.status ?? 1);
