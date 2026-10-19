/**
 * The identity puzzle ("reverse CAPTCHA").
 * The gateway sends 256 random bytes plus plain-English instructions with randomly varied wording.
 * An agent must turn the wording into exact byte operations, run them, hash the result and
 * stamp it with the one-time nonce — all before the challenge expires.
 */

export type PuzzleStep =
  | { type: "slice_reverse_xor"; start: number; end: number; xor_key: number }
  | { type: "slice_not"; start: number; end: number };

export type Challenge = {
  challenge_id: string;
  agent_id: string;
  data_b64: string;
  nonce: string;
  instructions: string[];
  expires_at: string;
};

const pick = <T>(items: T[]) => items[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32) * items.length)]!;

export function randomBytes(len: number) {
  const out = new Uint8Array(len);
  crypto.getRandomValues(out);
  return out;
}

export function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Step parameters come from the random payload, so every puzzle is different. */
export function makeSteps(data: Uint8Array): PuzzleStep[] {
  const a = data[12]!, b = data[77]!, c = data[199]!, d = data[240]!;
  const s1 = a % 160;
  const s2 = (d % 180) + 10;
  return [
    { type: "slice_reverse_xor", start: s1, end: Math.min(256, s1 + 32 + (b % 32)), xor_key: c },
    { type: "slice_not", start: s2, end: Math.min(256, s2 + 24 + (a % 40)) },
  ];
}

export function renderInstructions(steps: PuzzleStep[]): string[] {
  const lines = steps.map((step, i) => {
    const n = i + 1;
    const indexWord = pick(["index", "offset", "position"]);
    const endPhrase = pick(["up to (but not including)", "until (exclusive)", "ending just before"]);
    if (step.type === "slice_reverse_xor") {
      const verb = pick(["Extract", "Take", "Slice out", "Grab"]);
      const rev = pick(["reverse the slice", "mirror the byte order", "flip the sequence end-to-end"]);
      const xor = pick(["then XOR each byte with", "then exclusive-or every byte with", "then apply XOR per byte using"]);
      return `${n}. ${verb} bytes from ${indexWord} ${step.start} ${endPhrase} ${step.end}; ${rev}, ${xor} 0x${step.xor_key.toString(16).padStart(2, "0")}.`;
    }
    const verb = pick(["Extract", "Take", "Isolate", "Select"]);
    const not = pick(["bitwise invert each byte (NOT, 8-bit)", "flip all bits of every byte (NOT, 8-bit)", "replace each byte with its 8-bit bitwise complement"]);
    return `${n}. ${verb} bytes from ${indexWord} ${step.start} ${endPhrase} ${step.end}; ${not}.`;
  });
  lines.push(`${steps.length + 1}. Concatenate the raw byte outputs of the steps above in order and compute the SHA-256 hex digest. That hex string is the answer.`);
  return lines;
}

export function applySteps(dataB64: string, steps: PuzzleStep[]) {
  const data = base64ToBytes(dataB64);
  const chunks: Uint8Array[] = [];
  for (const step of steps) {
    const slice = data.slice(Math.max(0, step.start), Math.min(data.length, step.end));
    if (step.type === "slice_reverse_xor") chunks.push(slice.reverse().map((x) => x ^ (step.xor_key & 0xff)));
    else chunks.push(slice.map((x) => ~x & 0xff));
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return bytesToHex(new Uint8Array(digest));
}

export async function hmacSha256Hex(keyHex: string, message: string) {
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map((x) => Number.parseInt(x, 16)));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(sig));
}

/** What an agent sends back: the answer and the answer stamped with the one-time nonce. */
export async function solveWithSteps(challenge: Pick<Challenge, "data_b64" | "nonce">, steps: PuzzleStep[]) {
  const answer = await sha256Hex(applySteps(challenge.data_b64, steps));
  return { answer, hmac: await hmacSha256Hex(challenge.nonce, answer) };
}

/** Rule-based reader for the instruction wording (used by the built-in model). */
export function parseInstructionsHeuristically(instructions: string[]): PuzzleStep[] {
  const steps: PuzzleStep[] = [];
  for (const line of instructions) {
    const m = /(index|offset|position)\s+(\d+)[\s\S]*?(?:but not including|exclusive|ending just before)\)?\s*(\d+)/i.exec(line);
    if (!m) continue;
    const start = Number(m[2]);
    const end = Number(m[3]);
    const xor = /\bxor\b|exclusive-or/i.test(line);
    if (xor) {
      const key = /0x([0-9a-f]{2})/i.exec(line);
      if (!key) throw new Error("XOR key missing in instruction");
      steps.push({ type: "slice_reverse_xor", start, end, xor_key: Number.parseInt(key[1]!, 16) });
    } else if (/\bnot\b|invert|flip all bits|complement/i.test(line)) {
      steps.push({ type: "slice_not", start, end });
    }
  }
  if (!steps.length) throw new Error("no steps found in instructions");
  return steps;
}

export function isValidStepList(x: unknown): x is PuzzleStep[] {
  return (
    Array.isArray(x) &&
    x.length > 0 &&
    x.every(
      (s) =>
        s &&
        typeof s === "object" &&
        Number.isInteger((s as any).start) &&
        Number.isInteger((s as any).end) &&
        ((s as any).type === "slice_not" || ((s as any).type === "slice_reverse_xor" && Number.isInteger((s as any).xor_key)))
    )
  );
}
