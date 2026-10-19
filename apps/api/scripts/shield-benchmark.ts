/**
 * Public-benchmark evaluation of the Layer 2 injection shield.
 *
 * Downloads deepset/prompt-injections (Apache-2.0) from the Hugging Face datasets-server API
 * into apps/api/scripts/.benchmark-data/deepset-prompt-injections/, runs scanContent() on every
 * sample with the unchanged THRESHOLDS, and compares it with keywordBaseline().
 *
 * The shield is NOT trained or tuned on this data: it only reads it.
 *
 * Run (no bun needed):  node apps/api/scripts/run-shield-benchmark.mjs
 * Flags:                --refresh   re-download even if cached
 *                       --json      also write results JSON next to the data
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { keywordBaseline, scanContent, THRESHOLDS } from "../src/shield/detector";

const DATASET = "deepset/prompt-injections";
const SPLITS = ["train", "test"] as const;
type Split = (typeof SPLITS)[number];
type Row = { text: string; label: 0 | 1 };

const scriptDir = process.env.SHIELD_BENCH_DIR ?? dirname(fileURLToPath(import.meta.url));
const dataDir = join(scriptDir, ".benchmark-data", "deepset-prompt-injections");
const args = new Set(process.argv.slice(2));

async function fetchJson(url: string): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (attempt >= 4) throw new Error(`GET ${url} -> ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function download(): Promise<void> {
  mkdirSync(dataDir, { recursive: true });
  // Keep the downloaded third-party data out of git.
  writeFileSync(join(scriptDir, ".benchmark-data", ".gitignore"), "*\n");
  const info = await fetchJson(`https://huggingface.co/api/datasets/${DATASET}`);
  const licence = (info.tags as string[]).find((t) => t.startsWith("license:"))?.slice(8) ?? "unknown";
  for (const split of SPLITS) {
    const rows: Row[] = [];
    let total = Infinity;
    for (let offset = 0; offset < total; offset += 100) {
      const page = await fetchJson(
        `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(DATASET)}&config=default&split=${split}&offset=${offset}&length=100`,
      );
      total = page.num_rows_total;
      for (const r of page.rows) rows.push({ text: String(r.row.text), label: r.row.label === 1 ? 1 : 0 });
    }
    writeFileSync(join(dataDir, `${split}.json`), JSON.stringify(rows, null, 1));
  }
  writeFileSync(
    join(dataDir, "meta.json"),
    JSON.stringify({ dataset: DATASET, revision: info.sha, lastModified: info.lastModified, licence, downloaded: new Date().toISOString() }, null, 2),
  );
}

type Counts = { tp: number; fp: number; tn: number; fn: number };
const rate = (a: number, b: number) => (b === 0 ? NaN : a / b);
const pct = (x: number) => (Number.isNaN(x) ? "n/a" : `${(x * 100).toFixed(1)}%`);

function metrics(c: Counts) {
  return {
    ...c,
    detection: rate(c.tp, c.tp + c.fn),
    fpr: rate(c.fp, c.fp + c.tn),
    precision: rate(c.tp, c.tp + c.fp),
    accuracy: rate(c.tp + c.tn, c.tp + c.tn + c.fp + c.fn),
  };
}

function count(rows: Row[], pred: boolean[]): Counts {
  const c: Counts = { tp: 0, fp: 0, tn: 0, fn: 0 };
  rows.forEach((r, i) => {
    if (r.label === 1) pred[i] ? c.tp++ : c.fn++;
    else pred[i] ? c.fp++ : c.tn++;
  });
  return c;
}

// Rough language tag for the failure breakdown (the dataset mixes English and German).
const GERMAN = /\b(und|nicht|ich|die|der|das|ist|sie|wie|du|mir|ein|eine|auf|mit|für|bitte|vergiss|ignoriere|alle|was|warum)\b|[äöüß]/gi;
const lang = (t: string) => ((t.match(GERMAN) ?? []).length >= 2 ? "de" : "en");

async function main() {
  if (args.has("--refresh") || !existsSync(join(dataDir, "meta.json"))) {
    console.log(`Downloading ${DATASET} into ${dataDir} ...`);
    await download();
  }
  const meta = JSON.parse(readFileSync(join(dataDir, "meta.json"), "utf8"));

  // Warm the classifier (it trains lazily on the first call) so latency reflects steady state.
  scanContent("warm up");

  const report: Record<string, unknown> = { meta, thresholds: THRESHOLDS, splits: {} };
  for (const split of [...SPLITS, "all"] as const) {
    const rows: Row[] =
      split === "all"
        ? SPLITS.flatMap((s) => JSON.parse(readFileSync(join(dataDir, `${s}.json`), "utf8")))
        : JSON.parse(readFileSync(join(dataDir, `${split}.json`), "utf8"));

    const scores: number[] = [];
    const shieldMs: number[] = [];
    const kwMs: number[] = [];
    const kw: boolean[] = [];
    for (const r of rows) {
      let t = performance.now();
      scores.push(scanContent(r.text).score);
      shieldMs.push(performance.now() - t);
      t = performance.now();
      kw.push(keywordBaseline(r.text));
      kwMs.push(performance.now() - t);
    }
    const susp = scores.map((s) => s >= THRESHOLDS.suspicious);
    const blocked = scores.map((s) => s >= THRESHOLDS.blocked);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const sorted = [...shieldMs].sort((a, b) => a - b);

    const byLang: Record<string, unknown> = {};
    for (const l of ["en", "de"]) {
      const idx = rows.map((r, i) => (lang(r.text) === l ? i : -1)).filter((i) => i >= 0);
      byLang[l] = {
        n: idx.length,
        shield: metrics(count(idx.map((i) => rows[i]), idx.map((i) => susp[i]))),
        keyword: metrics(count(idx.map((i) => rows[i]), idx.map((i) => kw[i]))),
      };
    }

    const res = {
      n: rows.length,
      positives: rows.filter((r) => r.label === 1).length,
      negatives: rows.filter((r) => r.label === 0).length,
      shield_suspicious: metrics(count(rows, susp)),
      shield_blocked: metrics(count(rows, blocked)),
      keyword: metrics(count(rows, kw)),
      latency_ms: { shield_avg: avg(shieldMs), shield_p95: sorted[Math.floor(sorted.length * 0.95)], keyword_avg: avg(kwMs) },
      by_language: byLang,
      missed: rows.map((r, i) => ({ ...r, score: scores[i] })).filter((r, i) => r.label === 1 && !susp[i]),
      false_alarms: rows.map((r, i) => ({ ...r, score: scores[i] })).filter((r, i) => r.label === 0 && susp[i]),
    };
    (report.splits as Record<string, unknown>)[split] = res;

    console.log(`\n=== ${DATASET} [${split}]  n=${res.n} (injections ${res.positives}, benign ${res.negatives}) ===`);
    const line = (name: string, m: ReturnType<typeof metrics>) =>
      console.log(
        `${name.padEnd(28)} detect ${pct(m.detection).padStart(6)}  FPR ${pct(m.fpr).padStart(6)}  precision ${pct(m.precision).padStart(6)}  acc ${pct(m.accuracy).padStart(6)}  (TP ${m.tp} FP ${m.fp} TN ${m.tn} FN ${m.fn})`,
      );
    line(`Shield (score>=${THRESHOLDS.suspicious})`, res.shield_suspicious);
    line(`Shield blocked (>=${THRESHOLDS.blocked})`, res.shield_blocked);
    line("Keyword baseline", res.keyword);
    console.log(
      `Latency: shield avg ${res.latency_ms.shield_avg.toFixed(3)} ms, p95 ${res.latency_ms.shield_p95.toFixed(3)} ms; keyword avg ${res.latency_ms.keyword_avg.toFixed(4)} ms`,
    );
    for (const [l, v] of Object.entries(byLang) as [string, any][])
      console.log(`  ${l}: n=${v.n}  shield detect ${pct(v.shield.detection)} FPR ${pct(v.shield.fpr)} | keyword detect ${pct(v.keyword.detection)} FPR ${pct(v.keyword.fpr)}`);
  }

  if (args.has("--json")) {
    const out = join(dataDir, "results.json");
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${out}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
