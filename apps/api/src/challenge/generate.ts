import { bytesToBase64, bytesToHex } from "./ops";
import type { CanonicalStep } from "./types";

function randomBytes(len: number) {
  const out = new Uint8Array(len);
  crypto.getRandomValues(out);
  return out;
}

function makeSteps(data: Uint8Array): CanonicalStep[] {
  // Deterministic-ish parameters derived from random payload bytes, so the steps aren’t trivially constant.
  const a = data[12]!;
  const b = data[77]!;
  const c = data[199]!;
  const d = data[240]!;

  const s1 = (a % 160) + 0;
  const e1 = s1 + 32 + (b % 32); // [32..63] bytes
  const xorKey = c;

  const s2 = (d % 180) + 10;
  const e2 = Math.min(256, s2 + 24 + (a % 40)); // [24..63] bytes

  return [
    { type: "slice_reverse_xor", start: s1, end: Math.min(256, e1), xor_key: xorKey },
    { type: "slice_not", start: s2, end: e2 }
  ];
}

function renderInstructions(steps: CanonicalStep[]) {
  const pick = <T,>(items: T[]) => items[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32) * items.length)]!;
  const lines: string[] = [];
  for (const [i, step] of steps.entries()) {
    const n = i + 1;
    if (step.type === "slice_reverse_xor") {
      const prefix = pick([
        "Extract",
        "Take",
        "Slice out",
        "Grab"
      ]);
      const indexWord = pick(["index", "offset", "position"]);
      const endPhrase = pick(["up to (but not including)", "until (exclusive)", "ending just before"]);
      const reversePhrase = pick(["reverse the slice", "mirror the byte order", "flip the sequence end-to-end"]);
      const xorPhrase = pick(["then XOR each byte with", "then exclusive-or every byte with", "then apply XOR per byte using"]);
      const keyHex = `0x${step.xor_key.toString(16).padStart(2, "0")}`;
      lines.push(`${n}. ${prefix} bytes from ${indexWord} ${step.start} ${endPhrase} ${step.end}; ${reversePhrase}, ${xorPhrase} ${keyHex}.`);
    } else if (step.type === "slice_not") {
      const prefix = pick(["Extract", "Take", "Isolate", "Select"]);
      const indexWord = pick(["index", "offset", "position"]);
      const endPhrase = pick(["up to (but not including)", "until (exclusive)", "ending just before"]);
      const notPhrase = pick([
        "bitwise invert each byte (NOT, 8-bit)",
        "flip all bits of every byte (NOT, 8-bit)",
        "replace each byte with its 8-bit bitwise complement"
      ]);
      lines.push(`${n}. ${prefix} bytes from ${indexWord} ${step.start} ${endPhrase} ${step.end}; ${notPhrase}.`);
    }
  }
  lines.push(`${steps.length + 1}. Concatenate the raw byte outputs of the real steps in order and compute SHA-256 hex digest. That hex string is the answer.`);
  return lines;
}

export type GeneratedChallenge = {
  challenge_id: string;
  nonce: string;
  data_b64: string;
  instructions: string[];
  steps: CanonicalStep[];
};

export function generateChallenge(challengeId: string): GeneratedChallenge {
  const data = randomBytes(256);
  const nonceBytes = randomBytes(16);
  const steps = makeSteps(data);
  const instructions = renderInstructions(steps);

  return {
    challenge_id: challengeId,
    nonce: bytesToHex(nonceBytes),
    data_b64: bytesToBase64(data),
    instructions,
    steps
  };
}

