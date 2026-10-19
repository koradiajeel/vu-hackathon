export type CanonicalStep =
  | { type: "slice_reverse_xor"; start: number; end: number; xor_key: number }
  | { type: "slice_not"; start: number; end: number };

function parseIntStrict(x: string) {
  const n = Number.parseInt(x, 10);
  if (!Number.isFinite(n)) throw new Error(`invalid int: ${x}`);
  return n;
}

function parseHexByte(x: string) {
  const cleaned = x.toLowerCase().startsWith("0x") ? x.slice(2) : x;
  const n = Number.parseInt(cleaned, 16);
  if (!Number.isFinite(n) || n < 0 || n > 255) throw new Error(`invalid hex byte: ${x}`);
  return n;
}

const reSlice = /(index|offset|position)\s+(\d+)[\s\S]*?(?:but not including|exclusive|ending just before)\)?\s*(\d+)/i;
const reXorKey = /(0x[0-9a-f]{2})/i;
const reHasReverse = /(reverse|mirror|flip)[\s\S]*?(slice|byte order|sequence)/i;
const reHasXor = /\bxor\b|exclusive-or/i;
const reHasNot = /\bnot\b|invert|flip all bits|complement/i;

/**
 * MVP Phase 1.5 heuristic parser.
 *
 * Works because the server’s instruction renderer is controlled and always includes:
 * - explicit numeric slice bounds
 * - explicit 0xNN XOR key for the XOR step
 */
export function parseCanonicalStepsFromInstructions(instructions: string[]): CanonicalStep[] {
  const steps: CanonicalStep[] = [];

  for (const line of instructions) {
    const sliceMatch = line.match(reSlice);
    if (!sliceMatch) continue;

    const start = parseIntStrict(sliceMatch[2]!);
    const end = parseIntStrict(sliceMatch[3]!);

    const isXorish = reHasXor.test(line) && reHasReverse.test(line);
    const isNotish = reHasNot.test(line) && !reHasXor.test(line);

    if (isXorish) {
      const keyMatch = line.match(reXorKey);
      if (!keyMatch) throw new Error("could not find XOR key in instruction");
      steps.push({ type: "slice_reverse_xor", start, end, xor_key: parseHexByte(keyMatch[1]!) });
    } else if (isNotish) {
      steps.push({ type: "slice_not", start, end });
    }
  }

  if (steps.length === 0) throw new Error("no steps parsed from instructions");
  return steps;
}

