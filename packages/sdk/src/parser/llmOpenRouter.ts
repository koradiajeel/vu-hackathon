import type { CanonicalStep } from "../solver";

export type OpenRouterParserOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

/**
 * Parse canonical steps from natural-language instructions using
 * OpenRouter + a Grok model (or any OpenRouter-compatible model).
 *
 * This function is meant to run in a Node/edge agent runtime, not in the browser.
 */
export async function parseStepsWithOpenRouter(
  instructions: string[],
  opts: OpenRouterParserOptions = {}
): Promise<CanonicalStep[]> {
  const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const model = opts.model ?? process.env.OPENROUTER_MODEL ?? "x-ai/grok-4-fast";
  const baseUrl = (opts.baseUrl ?? process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");

  const schemaDescription = `
Return ONLY a JSON object with this shape:

{
  "steps": [
    {"type":"slice_reverse_xor","start":<int>,"end":<int>,"xor_key":<int 0-255>},
    {"type":"slice_not","start":<int>,"end":<int>}
  ]
}

Rules:
- "start" and "end" use zero-based indices, "end" is exclusive.
- For reverse+XOR steps, you MUST infer the XOR key as an integer 0-255 from the text (e.g. 0x63 -> 99).
`.trim();

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "You convert natural language byte-manipulation instructions into a small JSON program for an agent. " +
        "Follow the requested JSON schema EXACTLY. Do not include code fences or prose."
    },
    {
      role: "user",
      content:
        schemaDescription +
        "\n\nHere are the instructions, each item is one bullet:\n\n" +
        instructions.map((line, idx) => `${idx + 1}. ${line}`).join("\n")
    }
  ];

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://capgent.local/",
      "X-Title": "Capgent Agent Parser"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as any;
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter response missing content");

  let parsed: unknown = content;
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("OpenRouter did not return valid JSON");
    }
  }

  const arr =
    Array.isArray(parsed) ?
      parsed :
      (parsed as any).steps && Array.isArray((parsed as any).steps) ?
        (parsed as any).steps :
        null;
  if (!Array.isArray(arr)) {
    throw new Error(
      `OpenRouter JSON did not contain an array of steps (got: ${JSON.stringify(parsed).slice(0, 400)})`
    );
  }

  const steps: CanonicalStep[] = arr.map((s: any) => {
    if (!s || typeof s !== "object") throw new Error("invalid step object");
    if (s.type === "slice_reverse_xor") {
      return {
        type: "slice_reverse_xor",
        start: Number(s.start),
        end: Number(s.end),
        xor_key: Number(s.xor_key)
      } as CanonicalStep;
    }
    if (s.type === "slice_not") {
      return {
        type: "slice_not",
        start: Number(s.start),
        end: Number(s.end)
      } as CanonicalStep;
    }
    throw new Error(`unknown step type: ${String((s as any).type)}`);
  });

  if (!steps.length) throw new Error("OpenRouter returned an empty step list");
  return steps;
}

