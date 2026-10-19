export function sliceBytes(data: Uint8Array, start: number, end: number) {
  const s = Math.max(0, start);
  const e = Math.min(data.length, end);
  return data.slice(s, Math.max(s, e));
}

export function reverseBytes(bytes: Uint8Array) {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[bytes.length - 1 - i];
  return out;
}

export function xorBytes(bytes: Uint8Array, key: number) {
  const k = key & 0xff;
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ k;
  return out;
}

export function notBytes(bytes: Uint8Array) {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = (~bytes[i]) & 0xff;
  return out;
}

export function concatBytes(chunks: Uint8Array[]) {
  const len = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string) {
  const normalized = hex.trim().toLowerCase();
  if (normalized.length % 2 !== 0) throw new Error("invalid hex");
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  return out;
}

