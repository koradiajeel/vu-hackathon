import { AgentWardenClient, builtin, gemini, groq, ollama, openrouter, type AgentModel } from "../../../../../../packages/agentwarden/src/index";
import { createDemoGateway, DEMO_AGENTS, DEMO_QUESTIONS, RESEARCH_AGENT_POLICY, RESEARCH_QUESTIONS } from "../../../../../../packages/agentwarden/src/demo";
import { tableDecision, columnDenied, type AgentConfig, type Gateway } from "../../../../../../packages/agentwarden/src/gateway";

// Department data gateway demo.
//   /api/agentwarden/gateway/*  the real gateway (any agent can call it over HTTP)
//   /api/agentwarden/demo/*     runs the three demo agents for the /data-gateway page
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GATEWAY_BASE = "/api/agentwarden/gateway";
const UNREGISTERED = { id: "ollama-research-bot", name: "Research Bot", department: "unknown" };

/** The model behind the registered agents: Gemini, Groq or OpenRouter when a key is set, otherwise the offline stand-in. */
function departmentModel(): AgentModel {
  if (process.env.GEMINI_API_KEY) return gemini({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
  if (process.env.GROQ_API_KEY) return groq({ apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL || undefined });
  if (process.env.OPENROUTER_API_KEY) return openrouter({ apiKey: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash" });
  return builtin();
}

type DemoState = { gateway: Gateway; clients: Map<string, AgentWardenClient>; lastConnect: Map<string, unknown>; researchRegistered: boolean };

async function createState(): Promise<DemoState> {
  const gateway = await createDemoGateway({ basePath: GATEWAY_BASE, jwtSecret: process.env.CAPAGENT_JWT_SECRET });
  const fetchIn = (req: Request) => gateway.fetch(req);
  const clients = new Map<string, AgentWardenClient>();
  for (const a of DEMO_AGENTS) {
    clients.set(a.id, new AgentWardenClient({ gatewayUrl: `http://internal${GATEWAY_BASE}`, agentId: a.id, agentSecret: a.secret, model: departmentModel(), fetch: fetchIn }));
  }
  clients.set(
    UNREGISTERED.id,
    new AgentWardenClient({ gatewayUrl: `http://internal${GATEWAY_BASE}`, agentId: UNREGISTERED.id, model: ollama({ model: process.env.OLLAMA_MODEL || "llama3.2" }), fetch: fetchIn })
  );
  return { gateway, clients, lastConnect: new Map(), researchRegistered: false };
}

function getState(reset = false): Promise<DemoState> {
  const g = globalThis as any;
  if (reset || !g.__agentwarden_demo) g.__agentwarden_demo = createState();
  return g.__agentwarden_demo;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function demoState() {
  const s = await getState();
  const catalog = s.gateway.catalog();
  const model = departmentModel();
  const agents = [
    ...[...DEMO_AGENTS, ...s.gateway.agents().filter((a) => !DEMO_AGENTS.some((d) => d.id === a.id))].map((a: AgentConfig) => {
      const c = s.clients.get(a.id)!;
      return {
        id: a.id,
        name: a.name,
        department: a.department,
        description: a.description,
        registered: true,
        model: { provider: model.provider, label: model.label },
        connected: c.connected,
        connect: s.lastConnect.get(a.id) ?? null,
        policy: a.policy,
        tables: catalog.map((t) => ({
          table: t.table,
          allowed: tableDecision(a.policy, t.table, a.department).allowed,
          hidden_columns: t.columns.filter((col) => columnDenied(a.policy, t.table, col)),
        })),
      };
    }),
    ...(s.researchRegistered ? [] : [{
      id: UNREGISTERED.id,
      name: UNREGISTERED.name,
      department: UNREGISTERED.department,
      description: "An outside agent running a local Ollama model. Nobody registered it with a department.",
      registered: false,
      model: { provider: "ollama", label: `Ollama (${process.env.OLLAMA_MODEL || "llama3.2"})` },
      connected: false,
      connect: s.lastConnect.get(UNREGISTERED.id) ?? null,
      policy: null,
      tables: catalog.map((t) => ({ table: t.table, allowed: false, hidden_columns: [] as string[] })),
    }]),
  ];
  return {
    agents,
    database: catalog.map((t) => ({ table: t.table, columns: t.columns, description: t.description ?? "" })),
    sandbox: { kind: s.gateway.sandbox().kind, limits: s.gateway.sandbox().limits() },
    audit: s.gateway.audit().slice(0, 12),
    questions: { ...DEMO_QUESTIONS, [UNREGISTERED.id]: s.researchRegistered ? RESEARCH_QUESTIONS : DEMO_QUESTIONS["finance-analyst"]!.filter((q) => q.expect === "allowed").concat(DEMO_QUESTIONS["finance-analyst"]!.filter((q) => q.expect === "blocked").slice(0, 1)) },
    model_note: model.provider === "builtin" ? "No AI key set (GEMINI_API_KEY or GROQ_API_KEY): registered agents use the built-in demo model, which only understands the example questions." : null,
  };
}

async function handler(req: Request) {
  const path = new URL(req.url).pathname;
  const s = await getState();

  if (path.startsWith(GATEWAY_BASE)) return s.gateway.fetch(req);

  if (path === "/api/agentwarden/demo/state" && req.method === "GET") return json(await demoState());

  if (path === "/api/agentwarden/demo/reset" && req.method === "POST") {
    await getState(true);
    return json(await demoState());
  }

  const body = (await req.json().catch(() => null)) as null | { agent?: string; question?: string };
  const client = s.clients.get(String(body?.agent ?? ""));
  if (!client) return json({ error: "unknown_agent" }, 404);

  // Someone in R&D registers the outside Research Bot: from now on it gets puzzles and reads only R&D data.
  if (path === "/api/agentwarden/demo/register" && req.method === "POST") {
    if (body!.agent !== UNREGISTERED.id) return json({ error: "Only the Research Bot can be registered in this demo." }, 400);
    if (!s.researchRegistered) {
      const secret = crypto.randomUUID();
      await s.gateway.registerAgent({ ...RESEARCH_AGENT_POLICY, secret });
      s.clients.set(UNREGISTERED.id, new AgentWardenClient({ gatewayUrl: `http://internal${GATEWAY_BASE}`, agentId: UNREGISTERED.id, agentSecret: secret, model: departmentModel(), fetch: (r) => s.gateway.fetch(r) }));
      s.lastConnect.delete(UNREGISTERED.id);
      s.researchRegistered = true;
    }
    return json(await demoState());
  }

  if (path === "/api/agentwarden/demo/connect" && req.method === "POST") {
    const r = await client.connect();
    s.lastConnect.set(String(body!.agent), r);
    return json(r);
  }

  if (path === "/api/agentwarden/demo/ask" && req.method === "POST") {
    const question = String(body?.question ?? "").trim();
    if (!question) return json({ error: "Type a question first." }, 400);
    if (question.length > 1000) return json({ error: "Question is too long (max 1000 characters)." }, 400);
    let connect = null;
    if (!client.connected) {
      connect = await client.connect();
      s.lastConnect.set(String(body!.agent), connect);
    }
    const result = await client.ask(question);
    return json({ connect, result });
  }

  return json({ error: "not_found" }, 404);
}

export const GET = handler;
export const POST = handler;
