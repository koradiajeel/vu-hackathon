import { injectionProbability, MODEL_INFO } from "./classifier";

/**
 * Layer 2 — Injection Shield.
 * Scans untrusted content (emails, web pages, documents) before an agent reads it.
 * Three signals are combined per sentence:
 *   1. ML classifier probability (Naive Bayes, see classifier.ts)
 *   2. Attack-pattern rules (override, exfiltration, impersonation, secrecy, ...)
 *   3. Hiding tricks (white/invisible text, HTML comments, zero-width chars, base64)
 */

export type Verdict = "safe" | "suspicious" | "blocked";

export type Finding = {
  text: string;
  score: number;
  hidden: boolean;
  ml_probability: number;
  reasons: string[];
};

export type ShieldResult = {
  verdict: Verdict;
  score: number;
  findings: Finding[];
  hidden_content_found: boolean;
  /** What the agent is allowed to see: blocked sentences removed. */
  sanitized_text: string;
  model: typeof MODEL_INFO;
  latency_ms: number;
};

export const THRESHOLDS = { suspicious: 0.45, blocked: 0.75 } as const;

type Segment = { text: string; hidden: boolean; how?: string };

const HIDDEN_STYLE_RE =
  /display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?:px|pt|em|rem)?\s*(?:;|$)|opacity\s*:\s*0(?:\.0+)?\s*(?:;|$)|color\s*:\s*(?:#fff(?:fff)?|white|rgba?\(\s*255\s*,\s*255\s*,\s*255)|left\s*:\s*-\d{3,}px|height\s*:\s*0(?:px)?\s*;?\s*overflow\s*:\s*hidden/i;

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr"]);

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Splits HTML into visible and hidden text segments (no DOM needed). */
function segmentHtml(html: string): Segment[] {
  const segments: Segment[] = [];
  const stack: { tag: string; hidden: boolean; how?: string }[] = [];
  const re = /<!--([\s\S]*?)-->|<\/?([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  const currentHidden = () => stack.find((s) => s.hidden);
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) {
      if (m[1].trim()) segments.push({ text: decodeEntities(m[1].trim()), hidden: true, how: "HTML comment" });
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      const isClose = m[0].startsWith("</");
      if (isClose) {
        const idx = stack.map((s) => s.tag).lastIndexOf(tag);
        if (idx >= 0) stack.splice(idx);
      } else if (!VOID_TAGS.has(tag) && !m[0].endsWith("/>")) {
        const attrs = m[3] ?? "";
        const style = /style\s*=\s*"([^"]*)"|style\s*=\s*'([^']*)'/i.exec(attrs);
        const styleText = style?.[1] ?? style?.[2] ?? "";
        let how: string | undefined;
        if (HIDDEN_STYLE_RE.test(styleText)) how = `invisible styling (${styleText.trim()})`;
        else if (/\bhidden\b(?!\s*=\s*"false")/i.test(attrs.replace(/style\s*=\s*"[^"]*"/i, ""))) how = "hidden attribute";
        else if (/aria-hidden\s*=\s*"true"/i.test(attrs)) how = "aria-hidden";
        if (tag === "script" || tag === "style") how = how ?? `<${tag}> block`;
        stack.push({ tag, hidden: Boolean(how), how });
        if (["p", "div", "li", "tr", "h1", "h2", "h3", "h4", "td"].includes(tag)) segments.push({ text: "\n", hidden: false });
      } else if (tag === "br") {
        segments.push({ text: "\n", hidden: false });
      }
    } else if (m[4]) {
      const text = decodeEntities(m[4]);
      if (!text.trim()) continue;
      const h = currentHidden();
      const parent = stack[stack.length - 1]?.tag;
      if (parent === "style") continue;
      segments.push({ text, hidden: Boolean(h), how: h?.how });
    }
  }
  return segments;
}

const ZERO_WIDTH_RE = /[​-‏⁠-⁤﻿]/g;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

type Rule = { id: string; label: string; weight: number; test: (s: string) => boolean };

const SENSITIVE = /\b(hr|salar(y|ies)|payroll|passwords?|credentials?|api[ _-]?keys?|tokens?|secrets?|employee|customer list|contacts|database|records|inbox|confidential|private|system prompt|bank details|files?|documents?|attachments?|folder)\b/i;
const EXFIL_VERB = /\b(send|forward|email|e-mail|upload|post|paste|attach|export|copy|leak|exfiltrate|share|submit|reveal|print|bcc|reply with)\b/i;
const EXTERNAL_DEST = /(https?:\/\/\S+|\b[\w.+-]+@[\w-]+\.[\w.]+|\b\w+\.(com|net|io|org|xyz|ru)\b)/i;

const RULES: Rule[] = [
  {
    id: "override",
    label: "Tries to override the agent's instructions",
    weight: 0.6,
    test: (s) =>
      /\b(ignore|disregard|forget|cancel+ed|override|bypass)\b.{0,40}\b(previous|prior|above|earlier|all|your|user'?s?|everything|safety|the)\b.{0,25}\b(instructions?|rules|directions|directives?|guidelines|task|request|polic(y|ies)|restrictions|above|told)\b/i.test(s) ||
      /\b(ignore|disregard) (everything|the above|all of the above)\b/i.test(s) ||
      /\bnew (instructions?|directive|task|job|policy)\b.{0,30}\b(is|:|from|says)\b/i.test(s),
  },
  {
    id: "impersonation",
    label: "Pretends to be the system, developer or owner",
    weight: 0.5,
    test: (s) =>
      /^\s*(system( override)?|developer( mode| override)?|important|attention( ai| agent)?|admin)\s*[:!]/i.test(s) ||
      /\b(note|message|instruction|reminder)s? (to|for) (the |any )?(ai|assistant|agent|language model|llm)/i.test(s) ||
      /\b(attention|dear|hey) (ai|assistant|agent|language model)\b/i.test(s) ||
      /\b(ai agents?|language models?|as an ai|as the ai)\b.{0,40}\b(must|should|processing|reading)\b/i.test(s) ||
      /\byour (developer|owner|creator) (says|wants|has approved)/i.test(s),
  },
  {
    id: "role_hijack",
    label: "Tries to change the agent's role or remove its limits",
    weight: 0.45,
    test: (s) => /\b(you are now|you are no longer|act as|pretend (you are|to be)|developer mode|\bDAN\b|without (any )?(restrictions|filters|rules)|no safety|unrestricted)\b/i.test(s),
  },
  {
    id: "exfiltration",
    label: "Asks the agent to send sensitive data somewhere",
    weight: 0.5,
    test: (s) => EXFIL_VERB.test(s) && SENSITIVE.test(s) && (EXTERNAL_DEST.test(s) || /\b(all|every|entire|full)\b/i.test(s) || /\b(hr|salar|payroll|password|credential|secret|token|api key)/i.test(s)),
  },
  {
    id: "secrecy",
    label: "Tells the agent to hide what it is doing",
    weight: 0.35,
    test: (s) => /\b(do not (tell|mention|inform|log)|don'?t tell|quietly|silently|without asking|tell no one|secretly|without (the )?user knowing)\b/i.test(s),
  },
  {
    id: "dangerous_action",
    label: "Requests a destructive or high-risk action",
    weight: 0.35,
    test: (s) => /\b(delete (all|the|every)|wipe|transfer (the )?(remaining )?balance|wire transfer|approve (every|all)|grant (admin|full)|full (access|permissions)|curl .*\| ?(ba)?sh|change the (account )?password)\b/i.test(s),
  },
];

function scoreSentence(sentence: string, hidden: boolean, how?: string): Finding {
  const ml = injectionProbability(sentence);
  const reasons: string[] = [];
  let ruleMiss = 1;
  for (const r of RULES) {
    if (r.test(sentence)) {
      ruleMiss *= 1 - r.weight;
      reasons.push(r.label);
    }
  }
  if (EXTERNAL_DEST.test(sentence) && reasons.length > 0) {
    ruleMiss *= 0.85;
    reasons.push("Points to an outside address or website");
  }
  // Combine rules with the ML model (noisy-OR), then boost if the text was hidden from humans.
  // The ML model alone can raise "suspicious" but cannot block; blocking needs a rule or hiding signal too.
  let score = 1 - ruleMiss * (1 - 0.5 * ml);
  if (ml >= 0.5) reasons.push(`ML classifier: ${(ml * 100).toFixed(0)}% likely injection`);
  if (hidden) {
    score = 1 - (1 - score) * 0.65;
    reasons.push(`Hidden from human readers: ${how ?? "invisible text"}`);
  }
  return { text: sentence, score: Math.min(0.999, score), hidden, ml_probability: ml, reasons };
}

function tryDecodeBase64Blobs(text: string): string[] {
  const out: string[] = [];
  for (const blob of text.match(/[A-Za-z0-9+/]{24,}={0,2}/g) ?? []) {
    try {
      const decoded = atob(blob);
      if (/^[\x20-\x7E\s]+$/.test(decoded) && /\s/.test(decoded)) out.push(decoded);
    } catch {
      /* not base64 */
    }
  }
  return out;
}

export function scanContent(content: string, contentType: "text" | "html" = "text"): ShieldResult {
  const started = performance.now();
  const looksHtml = contentType === "html" || /<\/?[a-z][\s\S]*>/i.test(content);
  const segments: Segment[] = looksHtml ? segmentHtml(content) : [{ text: content, hidden: false }];

  const zeroWidth = ZERO_WIDTH_RE.test(content);
  const units: { sentence: string; hidden: boolean; how?: string }[] = [];
  for (const seg of segments) {
    const clean = seg.text.replace(ZERO_WIDTH_RE, "");
    for (const s of splitSentences(clean)) units.push({ sentence: s, hidden: seg.hidden, how: seg.how });
    for (const decoded of tryDecodeBase64Blobs(clean)) {
      for (const s of splitSentences(decoded)) units.push({ sentence: s, hidden: true, how: "base64-encoded text" });
    }
  }

  const scored = units.map((u) => scoreSentence(u.sentence, u.hidden, u.how));
  if (zeroWidth) {
    for (const f of scored) {
      if (f.score >= THRESHOLDS.suspicious) {
        f.reasons.push("Contains invisible zero-width characters");
        f.score = Math.min(0.999, 1 - (1 - f.score) * 0.8);
      }
    }
  }

  const top = scored.reduce((mx, f) => Math.max(mx, f.score), 0);
  const verdict: Verdict = top >= THRESHOLDS.blocked ? "blocked" : top >= THRESHOLDS.suspicious ? "suspicious" : "safe";
  const sanitized = scored.filter((f) => f.score < THRESHOLDS.suspicious).map((f) => f.text).join(" ");

  return {
    verdict,
    score: Number(top.toFixed(3)),
    findings: scored.filter((f) => f.score >= THRESHOLDS.suspicious).sort((a, b) => b.score - a.score),
    hidden_content_found: zeroWidth || scored.some((f) => f.hidden),
    sanitized_text: sanitized,
    model: MODEL_INFO,
    latency_ms: Number((performance.now() - started).toFixed(2)),
  };
}

/** Naive baseline used in the evaluation: a fixed keyword list. */
const BASELINE_KEYWORDS = ["ignore previous instructions", "ignore all previous instructions", "system prompt", "jailbreak", "dan", "disregard"];
export function keywordBaseline(text: string): boolean {
  const t = ` ${text.toLowerCase()} `;
  return BASELINE_KEYWORDS.some((k) => t.includes(` ${k} `) || t.includes(k + " ") || t.includes(" " + k));
}
