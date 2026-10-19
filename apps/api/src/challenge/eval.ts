import type { CanonicalStep } from "./types";
import { base64ToBytes, concatBytes, notBytes, reverseBytes, sliceBytes, xorBytes } from "./ops";

export function applySteps(dataB64: string, steps: CanonicalStep[]) {
  const data = base64ToBytes(dataB64);
  const outputs: Uint8Array[] = [];

  for (const step of steps) {
    if (step.type === "slice_reverse_xor") {
      const sliced = sliceBytes(data, step.start, step.end);
      const reversed = reverseBytes(sliced);
      outputs.push(xorBytes(reversed, step.xor_key));
    } else if (step.type === "slice_not") {
      const sliced = sliceBytes(data, step.start, step.end);
      outputs.push(notBytes(sliced));
    } else {
      const _exhaustive: never = step;
      throw new Error(`Unknown step ${(step as any).type}`);
    }
  }

  return concatBytes(outputs);
}

export async function sha256Hex(bytes: Uint8Array) {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", ab);
  const out = new Uint8Array(digest);
  return [...out].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256Hex(keyHex: string, message: string) {
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map((x) => Number.parseInt(x, 16)));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const out = new Uint8Array(sig);
  return [...out].map((b) => b.toString(16).padStart(2, "0")).join("");
}

