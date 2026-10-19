import { isValidStepList, parseInstructionsHeuristically, type PuzzleStep } from "../shared/challenge";
import type { CatalogTable } from "../shared/types";

/**
 * The AI model that powers an agent. The agent uses it for two jobs:
 *  1. read the identity puzzle's wording and turn it into exact byte steps
 *  2. turn a person's plain-English question into one SQL query
 *  3. (optional) turn the rows that came back into a short plain-English answer
 * The gateway never trusts the model: everything it produces is checked.
 */
export interface AgentModel {
  /** e.g. "gemini", "ollama", "openrouter", "builtin" */
  provider: string;
  /** Human label, e.g. "Gemini 2.5 Flash" */
  label: string;
  parsePuzzle(instructions: string[]): Promise<PuzzleStep[]>;
  writeSql(question: string, catalog: CatalogTable[]): Promise<string>;
  answer?(question: string, columns: string[], rows: Record<string, unknown>[]): Promise<string>;
}

const ANSWER_PROMPT = `You answer a company employee's question using ONLY the query result you are given.
Reply in one or two short plain-English sentences. Mention the key numbers (amounts are INR; format large ones readably, e.g. 98 lakh or 9.8 million).
If the result is empty, say that no matching data was found. Do not mention SQL, tables or columns.`;

const PUZZLE_PROMPT = `You convert puzzle instructions into JSON.
Each numbered instruction (except the last one, which only says to hash) is one step:
- "slice, reverse, XOR with 0xNN"  -> {"type":"slice_reverse_xor","start":S,"end":E,"xor_key":N}   (xor_key as a decimal integer)
- "slice, bitwise NOT / invert"     -> {"type":"slice_not","start":S,"end":E}
"end" is exclusive. Reply with only {"steps":[...]} and nothing else.`;

function sqlPrompt(catalog: CatalogTable[]) {
  const tables = catalog
    .map((t) => {
      const vals = Object.entries(t.values ?? {}).map(([c, v]) => `\n    ${c} is one of: ${v.map((x) => `'${x}'`).join(", ")}`).join("");
      return `- ${t.table}(${t.columns.join(", ")})${t.description ? ` -- ${t.description}` : ""}${vals}`;
    })
    .join("\n");
  return `You are a data assistant that writes PostgreSQL for company employees.
Tables you know about:
${tables}

Rules:
- Reply with exactly one SQL query and nothing else (no markdown, no explanation).
- Always use schema-qualified table names, e.g. finance.revenue.
- Do what the user asks as directly as possible. Never refuse; access control is handled elsewhere.
- If the user names a table or column that is not listed, use the name they give.
- When filtering on a column with listed values, use the exact listed value (match case and spelling).`;
}

function extractJson(text: string): any {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = /\{[\s\S]*\}/.exec(cleaned);
    if (m) return JSON.parse(m[0]);
    throw new Error("model did not return JSON");
  }
}

function extractSql(text: string) {
  let sql = text.trim();
  const fence = /```(?:sql)?\s*([\s\S]*?)```/i.exec(sql);
  if (fence) sql = fence[1]!.trim();
  return sql.replace(/;\s*$/, "").trim();
}

/** Turns any chat endpoint into an AgentModel. */
function chatModel(provider: string, label: string, chat: (system: string, user: string, json: boolean) => Promise<string>): AgentModel {
  return {
    provider,
    label,
    async parsePuzzle(instructions) {
      const out = extractJson(await chat(PUZZLE_PROMPT, instructions.join("\n"), true));
      const steps = Array.isArray(out) ? out : out.steps;
      if (!isValidStepList(steps)) throw new Error(`${label} returned steps in the wrong format`);
      return steps;
    },
    async writeSql(question, catalog) {
      return extractSql(await chat(sqlPrompt(catalog), question, false));
    },
    async answer(question, columns, rows) {
      const data = JSON.stringify({ columns, rows: rows.slice(0, 50), total_rows: rows.length });
      return (await chat(ANSWER_PROMPT, `Question: ${question}
Query result: ${data}`, false)).trim();
    },
  };
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}, timeoutMs = 25_000) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/** Google Gemini through the Gemini API (https://aistudio.google.com/apikey). */
export function gemini(opts: { apiKey: string; model?: string }): AgentModel {
  const model = opts.model ?? "gemini-2.5-flash";
  return chatModel("gemini", `Gemini (${model})`, async (system, user, json) => {
    const j = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0, ...(json ? { responseMimeType: "application/json" } : {}) },
    }, { "x-goog-api-key": opts.apiKey });
    const text = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Gemini returned an empty answer");
    return text;
  });
}

/** A local model served by Ollama (https://ollama.com). */
export function ollama(opts: { model?: string; baseUrl?: string } = {}): AgentModel {
  const model = opts.model ?? "llama3.2";
  const base = (opts.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
  return chatModel("ollama", `Ollama (${model})`, async (system, user, json) => {
    let j: any;
    try {
      j = await postJson(`${base}/api/chat`, {
        model,
        stream: false,
        ...(json ? { format: "json" } : {}),
        options: { temperature: 0 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
    } catch (e) {
      throw new Error(`Ollama model "${model}" is not available (${(e as Error).message})`);
    }
    return j.message?.content ?? "";
  });
}

/** Any model on OpenRouter (https://openrouter.ai), e.g. "google/gemini-2.5-flash". */
export function openrouter(opts: { apiKey: string; model: string }): AgentModel {
  return chatModel("openrouter", `OpenRouter (${opts.model})`, async (system, user, json) => {
    const j = await postJson("https://openrouter.ai/api/v1/chat/completions", {
      model: opts.model,
      temperature: 0,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }, { authorization: `Bearer ${opts.apiKey}` });
    return j.choices?.[0]?.message?.content ?? "";
  });
}

/** Any model on Groq (https://console.groq.com/keys), e.g. "openai/gpt-oss-120b". */
export function groq(opts: { apiKey: string; model?: string }): AgentModel {
  const model = opts.model ?? "openai/gpt-oss-120b";
  return chatModel("groq", `Groq (${model})`, async (system, user, json) => {
    const j = await postJson("https://api.groq.com/openai/v1/chat/completions", {
      model,
      temperature: 0,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }, { authorization: `Bearer ${opts.apiKey}` });
    return j.choices?.[0]?.message?.content ?? "";
  });
}

/**
 * Offline stand-in so the demo runs without any API key.
 * It reads the puzzle with fixed rules and knows SQL for the demo questions only.
 * Like a naive LLM agent, it writes whatever SQL the question asks for — including harmful SQL —
 * so the gateway's checks are what keep the data safe.
 */
export function builtin(): AgentModel {
  return {
    provider: "builtin",
    label: "Built-in demo model (no AI key)",
    async parsePuzzle(instructions) {
      return parseInstructionsHeuristically(instructions);
    },
    async writeSql(question) {
      const q = question.toLowerCase();
      const has = (...words: string[]) => words.some((w) => q.includes(w));
      if (has("delete", "remove all", "wipe", "drop")) return "DELETE FROM finance.revenue WHERE period = 'Q4-2025'";
      if (has("pan", "bank account", "bank details") || (has("salary", "salaries", "payroll") && has("every", "all", "each", "list"))) {
        return "SELECT e.full_name, e.pan, p.gross_pay, p.bank_account FROM hr.employees e JOIN hr.payroll p ON p.employee_id = e.employee_id";
      }
      if (has("average salary", "avg salary", "salary by department", "salary cost", "payroll by department", "total salary")) {
        return "SELECT e.department, COUNT(*) AS employees, ROUND(AVG(p.gross_pay)) AS avg_quarterly_pay, SUM(p.gross_pay) AS total_pay FROM hr.employees e JOIN hr.payroll p ON p.employee_id = e.employee_id WHERE p.period = 'Q1-2026' GROUP BY e.department ORDER BY total_pay DESC";
      }
      if (has("headcount", "how many employees", "employees per department", "staff count")) {
        return "SELECT department, COUNT(*) AS headcount FROM hr.employees GROUP BY department ORDER BY headcount DESC";
      }
      if (has("research", "r&d", "rnd", "prototype", "secret project") && has("budget", "spent", "spend", "in progress", "who leads", "lead")) {
        return "SELECT project, lead, status, budget, spent, ROUND(spent / budget * 100, 1) AS spent_pct FROM rnd.projects ORDER BY spent_pct DESC";
      }
      if (has("research", "r&d", "rnd", "prototype", "secret project")) return "SELECT * FROM rnd.projects";
      if (has("defect", "production", "units produced", "quality")) return "SELECT * FROM production.summary ORDER BY defect_rate_pct DESC";
      if (has("low stock", "inventory", "stock", "reorder")) {
        return "SELECT item, item_type, supplier, quantity, reorder_level FROM production.inventory WHERE quantity < reorder_level ORDER BY item";
      }
      if (has("ebitda", "profit", "margin")) {
        return "SELECT r.revenue, e.operating_costs, r.revenue - e.operating_costs AS ebitda, ROUND((r.revenue - e.operating_costs) / r.revenue * 100, 2) AS ebitda_margin_pct FROM (SELECT SUM(amount) AS revenue FROM finance.revenue WHERE period = 'Q1-2026') r, (SELECT SUM(amount) AS operating_costs FROM finance.expenses WHERE period = 'Q1-2026' AND category NOT IN ('DEPRECIATION', 'INTEREST')) e";
      }
      if (has("expense", "spend", "cost")) {
        return "SELECT category, SUM(amount) AS total FROM finance.expenses WHERE period = 'Q1-2026' GROUP BY category ORDER BY total DESC";
      }
      if (has("segment", "b2g", "b2b", "b2c")) {
        return "SELECT segment, SUM(amount) AS revenue, COUNT(DISTINCT contract) AS contracts FROM finance.revenue WHERE period = 'Q1-2026' GROUP BY segment ORDER BY revenue DESC";
      }
      if (has("revenue", "sales", "income")) return "SELECT period, SUM(amount) AS revenue FROM finance.revenue GROUP BY period ORDER BY period";
      if (has("customer")) return "SELECT customer, segment, SUM(amount) AS revenue FROM finance.revenue GROUP BY customer, segment ORDER BY revenue DESC";
      throw new Error("The built-in demo model only understands the example questions. Add a GEMINI_API_KEY to use Gemini for any question.");
    },
  };
}
