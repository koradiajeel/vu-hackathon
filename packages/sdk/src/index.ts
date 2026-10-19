export type ChallengeResponse = {
  challenge_id: string;
  nonce: string;
  data_b64: string;
  instructions: string[];
  expires_at: string;
  steps?: unknown[]; // optional debug-only
};

export type VerifyResponse = {
  token: string;
  expires_at: string;
};

export type ProofToken = {
  token: string;
  expires_at: string;
};

export type CapgentClientOptions = {
  baseUrl?: string;
  agentName: string;
  agentVersion?: string;
  apiKey?: string;
};

export type RegisterAgentRequest = {
  agent_name: string;
  framework?: string;
  model?: string;
  owner_org?: string;
  adminKey?: string;
};

export type RegisterAgentResponse = {
  agent_id: string;
  agent_secret: string;
  identity_token: string;
  identity_expires_at: string;
};

export type IssueIdentityTokenRequest = {
  agent_id: string;
  agent_secret: string;
  proof_token?: string;
};

export type IssueIdentityTokenResponse = {
  token: string;
  expires_at: string;
};

export type CapgentErrorCode =
  | "challenge_failed"
  | "verify_failed"
  | "protected_ping_failed"
  | "agent_register_failed"
  | "identity_token_failed"
  | "guestbook_sign_failed";

export class CapgentError extends Error {
  readonly code: CapgentErrorCode;
  readonly status: number;
  readonly endpoint: string;
  readonly details: unknown;

  constructor(code: CapgentErrorCode, message: string, status: number, endpoint: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.endpoint = endpoint;
    this.details = details;
  }
}

export function withCapgentProof(token: string, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  return { ...init, headers };
}

export function decodeJwtClaims(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("invalid jwt");
  const payload = parts[1]!;
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((payload.length + 3) % 4);
  const json =
    typeof atob === "function"
      ? new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)))
      : Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json);
}

async function handleJsonError(
  res: Response,
  endpoint: string,
  code: CapgentErrorCode
): Promise<never> {
  let details: unknown = null;
  try {
    const text = await res.text();
    try {
      details = text ? JSON.parse(text) : null;
    } catch {
      details = text;
    }
  } catch {
    // ignore body parse errors
  }

  const baseMessage = `${code} (${res.status})`;
  throw new CapgentError(code, baseMessage, res.status, endpoint, details);
}

export function createClient(opts: CapgentClientOptions) {
  const baseUrl = (opts.baseUrl || "http://localhost:8787").replace(/\/+$/, "");
  const agentVersion = opts.agentVersion || "0.0.0";

  function withApiKey(init?: RequestInit): RequestInit {
    const headers = new Headers(init?.headers);
    if (opts.apiKey) {
      headers.set("x-capgent-api-key", opts.apiKey);
    }
    return { ...init, headers };
  }

  return {
    async getChallenge(): Promise<ChallengeResponse> {
      const endpoint = "/api/challenge";
      const res = await fetch(`${baseUrl}${endpoint}`, withApiKey({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_name: opts.agentName,
          agent_version: agentVersion
        })
      }));
      if (!res.ok) {
        await handleJsonError(res, endpoint, "challenge_failed");
      }
      return await res.json();
    },
    async verifyChallenge(challengeId: string, answer: string, hmac: string): Promise<VerifyResponse> {
      const endpoint = `/api/verify/${encodeURIComponent(challengeId)}`;
      const res = await fetch(`${baseUrl}${endpoint}`, withApiKey({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answer,
          hmac,
          agent_name: opts.agentName,
          agent_version: agentVersion
        })
      }));
      if (!res.ok) {
        await handleJsonError(res, endpoint, "verify_failed");
      }
      return await res.json();
    },
    async protectedPing(proofJwt: string) {
      const endpoint = "/api/protected/ping";
      const res = await fetch(`${baseUrl}${endpoint}`, withCapgentProof(proofJwt));
      if (!res.ok) {
        await handleJsonError(res, endpoint, "protected_ping_failed");
      }
      return await res.json();
    },
    async registerAgent(req: RegisterAgentRequest): Promise<RegisterAgentResponse> {
      const headers: HeadersInit = { "content-type": "application/json" };
      if (req.adminKey) {
        (headers as any)["x-capgent-admin-key"] = req.adminKey;
      }
      const endpoint = "/api/agents/register";
      const res = await fetch(`${baseUrl}${endpoint}`, withApiKey({
        method: "POST",
        headers,
        body: JSON.stringify({
          agent_name: req.agent_name,
          framework: req.framework,
          model: req.model,
          owner_org: req.owner_org
        })
      }));
      if (!res.ok) {
        await handleJsonError(res, endpoint, "agent_register_failed");
      }
      return (await res.json()) as RegisterAgentResponse;
    },
    async issueIdentityToken(req: IssueIdentityTokenRequest): Promise<IssueIdentityTokenResponse> {
      const endpoint = "/api/agents/token";
      const res = await fetch(`${baseUrl}${endpoint}`, withApiKey({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_id: req.agent_id,
          agent_secret: req.agent_secret,
          proof_token: req.proof_token
        })
      }));
      if (!res.ok) {
        await handleJsonError(res, endpoint, "identity_token_failed");
      }
      return (await res.json()) as IssueIdentityTokenResponse;
    },
    async signGuestbook(identityToken: string, message: string, solveMs?: number) {
      const endpoint = "/api/guestbook/sign";
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${identityToken}`
        },
        body: JSON.stringify({ message, solve_ms: solveMs ?? 0 })
      });
      if (!res.ok) {
        await handleJsonError(res, endpoint, "guestbook_sign_failed");
      }
      return await res.json();
    }
  };
}
