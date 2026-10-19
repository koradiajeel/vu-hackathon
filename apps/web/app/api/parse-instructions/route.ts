import { parseStepsWithOpenRouter } from "capgent-sdk/parser/llm-openrouter";
import { NextResponse } from "next/server";

/**
 * Server-only: parses natural-language instructions into canonical steps
 * using OpenRouter (e.g. Grok). API key stays on server.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const instructions = body?.instructions;
    if (!Array.isArray(instructions) || instructions.length === 0) {
      return NextResponse.json({ error: "instructions array required" }, { status: 400 });
    }

    const steps = await parseStepsWithOpenRouter(instructions);
    return NextResponse.json({ steps });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
