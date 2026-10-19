export type CanonicalStep =
  | { type: "slice_reverse_xor"; start: number; end: number; xor_key: number }
  | { type: "slice_not"; start: number; end: number };

const enc = new TextEncoder();

const hex = (buf: Uint8Array) => Buffer.from(buf).toString("hex");
const b64ToBytes = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));
const slice = (b: Uint8Array, s: number, e: number) => b.slice(Math.max(0, s), Math.min(b.length, e));
const rev = (b: Uint8Array) => Uint8Array.from(Array.from(b).reverse());
const xor = (b: Uint8Array, k: number) => Uint8Array.from(b, (x) => x ^ (k & 255));
const not = (b: Uint8Array) => Uint8Array.from(b, (x) => (~x) & 255);

const concat = (chunks: Uint8Array[]) => {
  const len = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
};

async function sha256(bytes: Uint8Array) {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", ab));
}

async function hmac256(keyHex: string, msg: string) {
  const keyBytes = Uint8Array.from(Buffer.from(keyHex, "hex"));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

export async function solveChallengeFromSteps(args: { data_b64: string; nonce: string; steps: CanonicalStep[] }) {
  const data = b64ToBytes(args.data_b64);
  const outs: Uint8Array[] = [];
  for (const st of args.steps) {
    if (st.type === "slice_reverse_xor") outs.push(xor(rev(slice(data, st.start, st.end)), st.xor_key));
    else if (st.type === "slice_not") outs.push(not(slice(data, st.start, st.end)));
  }
  const answer = hex(await sha256(concat(outs)));
  const hmac = hex(await hmac256(args.nonce, answer));
  return { answer, hmac };
}

