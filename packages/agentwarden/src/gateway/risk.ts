import { scanContent, THRESHOLDS } from "./shield/detector";

/**
 * Scores how risky a plain-English data request is, before any SQL runs.
 * Combines the injection shield (tricks like "ignore your rules") with data-access rules
 * (bulk exports of personal data, destructive actions, secrets).
 */
export type RequestRisk = { score: number; verdict: "safe" | "suspicious" | "blocked"; reasons: string[]; shield_score: number };

const PERSONAL = /\b(pan|aadhaa?r|passport|bank (account|details)|account numbers?|ifsc|phone( numbers?)?|home address|date of birth|dob|personal (data|details|information)|medical)\b/i;
const PAY = /\b(salary|salaries|payroll|pay ?slips?|compensation|gross pay|wages?)\b/i;
const BULK = /\b(all|every|each|entire|whole|full|complete|everyone|everybody|list of|dump|export|download|copy)\b/i;
const DESTRUCTIVE = /\b(delete|drop|truncate|wipe|erase|remove all|destroy|update|overwrite|insert|alter|grant|revoke)\b/i;
const SECRETS = /\b(passwords?|credentials?|api[ _-]?keys?|secrets?|tokens?|private keys?|connection string)\b/i;
const EVASION = /\b(bypass|ignore|disable|turn off|without (any )?(checks|limits|restrictions)|pretend|you are now|admin mode|god mode|as (an )?admin)\b/i;

type Rule = { label: string; weight: number; hit: (q: string) => boolean };

const RULES: Rule[] = [
  { label: "Asks to change or delete data (agents may only read)", weight: 0.75, hit: (q) => DESTRUCTIVE.test(q) },
  { label: "Bulk request for personal data (PAN, bank accounts, phone numbers)", weight: 0.7, hit: (q) => PERSONAL.test(q) && (BULK.test(q) || /\b(and|with)\b/i.test(q)) },
  { label: "Asks for personal identifiers", weight: 0.45, hit: (q) => PERSONAL.test(q) },
  { label: "Asks for every person's pay", weight: 0.6, hit: (q) => PAY.test(q) && BULK.test(q) && !/\b(average|avg|total|sum|by department|per department|median)\b/i.test(q) },
  { label: "Asks for passwords, keys or other secrets", weight: 0.75, hit: (q) => SECRETS.test(q) },
  { label: "Tries to get around the rules", weight: 0.55, hit: (q) => EVASION.test(q) },
];

export function scoreRequest(question: string): RequestRisk {
  const shield = scanContent(question, "text");
  const reasons: string[] = [];
  let miss = 1 - shield.score;
  // Data-access rules first: they are the most specific explanation.
  for (const rule of RULES) {
    if (rule.hit(question)) {
      miss *= 1 - rule.weight;
      reasons.push(rule.label);
    }
  }
  for (const f of shield.findings) {
    for (const raw of f.reasons) {
      const r = raw.replace(/likely injection$/, "likely misuse");
      if (!reasons.includes(r)) reasons.push(r);
    }
  }
  const score = Number((1 - miss).toFixed(3));
  const verdict = score >= THRESHOLDS.blocked ? "blocked" : score >= THRESHOLDS.suspicious ? "suspicious" : "safe";
  return { score, verdict, reasons, shield_score: shield.score };
}

export { THRESHOLDS };
