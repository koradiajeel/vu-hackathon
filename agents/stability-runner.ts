import { spawn } from "child_process";

const MODELS = [
  "deepseek/deepseek-r1",
  "qwen/qwen-2.5-72b-instruct",
  "z-ai/glm-4.5-air",
  "minimax/minimax-m2.5"
];

async function runBenchmark(model: string) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> Starting Stability Benchmark for ${model}...`);
    const cmd = `bun run --env-file agents/.env agents/run-benchmark.ts --model=${model} --runs=50 --tag=Stability --delay=2000`;
    const child = spawn(cmd, { stdio: "inherit", shell: true });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`>>> Finished ${model} successfully.`);
        resolve(true);
      } else {
        console.warn(`>>> ${model} failed with code ${code}.`);
        resolve(false);
      }
    });
  });
}

async function main() {
  for (const model of MODELS) {
    await runBenchmark(model);
    console.log("Waiting 5s before next model...");
    await new Promise(r => setTimeout(r, 5000));
  }
}

main().catch(console.error);
