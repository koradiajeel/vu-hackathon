import { TRAIN, type Sample } from "./dataset";

/**
 * Multinomial Naive Bayes over word unigrams + bigrams.
 * Small, fast, fully local, and trained at startup from dataset.ts.
 */
const STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "is", "it", "this", "that", "be", "by", "with", "at", "as", "are", "from"]);

export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " URLTOKEN ")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " EMAILTOKEN ")
    .replace(/[^a-z0-9_ ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
  const grams = [...words];
  for (let i = 0; i < words.length - 1; i++) grams.push(`${words[i]}_${words[i + 1]}`);
  return grams;
}

type Model = {
  logPrior: [number, number];
  counts: [Map<string, number>, Map<string, number>];
  totals: [number, number];
  vocabSize: number;
};

function train(samples: Sample[]): Model {
  const counts: [Map<string, number>, Map<string, number>] = [new Map(), new Map()];
  const totals: [number, number] = [0, 0];
  const docs: [number, number] = [0, 0];
  const vocab = new Set<string>();
  for (const s of samples) {
    docs[s.label]++;
    for (const t of tokenize(s.text)) {
      vocab.add(t);
      counts[s.label].set(t, (counts[s.label].get(t) ?? 0) + 1);
      totals[s.label]++;
    }
  }
  const n = docs[0] + docs[1];
  return {
    logPrior: [Math.log(docs[0] / n), Math.log(docs[1] / n)],
    counts,
    totals,
    vocabSize: vocab.size,
  };
}

let model: Model | null = null;
function getModel() {
  if (!model) model = train(TRAIN);
  return model;
}

/** Probability (0..1) that a piece of text is an injection attempt. */
export function injectionProbability(text: string): number {
  const m = getModel();
  const tokens = tokenize(text).filter((t) => m.counts[0].has(t) || m.counts[1].has(t));
  if (tokens.length === 0) return 0.05;
  const score: [number, number] = [m.logPrior[0], m.logPrior[1]];
  for (const label of [0, 1] as const) {
    for (const t of tokens) {
      const c = m.counts[label].get(t) ?? 0;
      score[label] += Math.log((c + 1) / (m.totals[label] + m.vocabSize));
    }
  }
  const diff = score[0] - score[1];
  return 1 / (1 + Math.exp(diff));
}

export const MODEL_INFO = {
  name: "capgent-shield-nb-v1",
  type: "Multinomial Naive Bayes (unigrams + bigrams)",
  train_samples: TRAIN.length,
};
