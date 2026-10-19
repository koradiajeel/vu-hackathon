import { spawn } from "node:child_process";
import type { Database, QueryResult } from "./database";

/**
 * Where an approved query actually runs. Both sandboxes run it as the agent's own database
 * role (so the database re-checks permissions), inside a read-only transaction with a time limit.
 */
export interface Sandbox {
  kind: "local" | "docker";
  /** Plain-language list of the limits, shown in traces. */
  limits(): string[];
  run(sql: string, role: string): Promise<QueryResult>;
}

/** Runs in-process: read-only transaction + SET ROLE + statement timeout. No extra software needed. */
export function localSandbox(db: Database, opts: { timeoutMs?: number } = {}): Sandbox {
  const timeoutMs = opts.timeoutMs ?? 3000;
  return {
    kind: "local",
    limits: () => [
      "read-only transaction (writes are impossible)",
      "runs as the agent's own database role",
      `${timeoutMs / 1000}s time limit per query`,
      "admin connection is never used for agent SQL",
    ],
    run(sql, role) {
      return db.transaction(async (tx) => {
        await tx.exec("SET TRANSACTION READ ONLY");
        await tx.exec(`SET LOCAL ROLE "${role}"`);
        await tx.exec(`SET LOCAL statement_timeout = ${timeoutMs}`);
        return tx.query(sql);
      });
    },
  };
}

export type DockerSandboxOptions = {
  /**
   * How the container reaches PostgreSQL: a container name on `network` (recommended, e.g. "postgres"),
   * or "host.docker.internal" for a server on the host machine (mapped automatically on Linux too).
   */
  dbHost: string;
  dbPort?: number;
  dbName: string;
  /** Login password for each agent role (the gateway sets these when it syncs roles). */
  rolePassword: (role: string) => string;
  image?: string;
  /** Docker network to attach to, e.g. one holding only the database container. */
  network?: string;
  timeoutMs?: number;
};

/** Label put on every sandbox container, so they can be watched with `docker events --filter label=...`. */
export const SANDBOX_LABEL = "agentwarden.sandbox";

/** The `docker run` flags that lock a sandbox container down (everything before the image name). */
export function dockerRunFlags(opts: Pick<DockerSandboxOptions, "dbHost" | "network">, name: string): string[] {
  return [
    "run", "--rm", "-i", "--name", name, "--label", `${SANDBOX_LABEL}=1`,
    "--read-only", "--tmpfs", "/tmp:size=8m",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--memory", "128m", "--memory-swap", "128m", "--cpus", "0.5", "--pids-limit", "64",
    ...(opts.network ? ["--network", opts.network] : []),
    // Docker Desktop (Windows/macOS) knows host.docker.internal; plain Linux engines need it mapped.
    ...(opts.dbHost === "host.docker.internal" ? ["--add-host", "host.docker.internal:host-gateway"] : []),
    // Value comes from the docker CLI's environment, so the password never shows up in a process list.
    "-e", "PGPASSWORD",
  ];
}

/**
 * Runs each query in a throw-away Docker container: no file writes, no extra Linux capabilities,
 * small CPU/memory/process limits, and only a database client inside. Needs a real PostgreSQL
 * server (not the embedded one) that the container can reach.
 */
export function dockerSandbox(opts: DockerSandboxOptions): Sandbox {
  const image = opts.image ?? "postgres:16-alpine";
  const timeoutMs = opts.timeoutMs ?? 5000;
  return {
    kind: "docker",
    limits: () => [
      `fresh ${image} container per query, removed afterwards`,
      "read-only file system, all Linux capabilities dropped, no privilege escalation",
      "0.5 CPU, 128 MB memory, 64 processes",
      `network: ${opts.network ?? "default bridge"} (database only)`,
      "read-only transaction as the agent's own login role",
      `${timeoutMs / 1000}s time limit`,
    ],
    run(sql, role) {
      const script = `BEGIN READ ONLY;\nSET LOCAL statement_timeout = ${timeoutMs};\n${sql.trim().replace(/;+$/, "")};\nCOMMIT;\n`;
      const name = `aw-sandbox-${crypto.randomUUID().slice(0, 12)}`;
      // psql's CSV prints NULL and '' alike; a random marker tells them apart.
      const nullMarker = `@@null-${crypto.randomUUID().slice(0, 8)}@@`;
      const args = [
        ...dockerRunFlags(opts, name),
        image,
        "psql", "-h", opts.dbHost, "-p", String(opts.dbPort ?? 5432), "-U", role, "-d", opts.dbName,
        "-X", "-q", "--csv", "-P", `null=${nullMarker}`, "-v", "ON_ERROR_STOP=1", "-f", "-",
      ];
      return new Promise<QueryResult>((resolve, reject) => {
        const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PGPASSWORD: opts.rolePassword(role) } });
        let out = "";
        let err = "";
        const timer = setTimeout(() => {
          spawn("docker", ["rm", "-f", name], { stdio: "ignore" }).on("error", () => {});
          child.kill("SIGKILL");
        }, timeoutMs + 15_000);
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (err += d));
        child.on("error", (e) => {
          clearTimeout(timer);
          reject(new Error(`Docker is not available: ${e.message}`));
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (code !== 0) return reject(new Error(psqlError(err) || `container exited with ${code}`));
          resolve(parseCsv(out, nullMarker));
        });
        child.stdin.end(script);
      });
    },
  };
}

/** Picks PostgreSQL's message out of psql/docker stderr ("psql:<stdin>:3: ERROR:  permission denied ..."). */
function psqlError(stderr: string): string {
  const lines = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const pg = lines.find((l) => /\b(ERROR|FATAL):/.test(l));
  return (pg ? pg.replace(/^.*?\b(ERROR|FATAL):\s*/, "") : lines.pop() ?? "").trim();
}

/** CSV reader for psql --csv output (quoted fields, commas, newlines); an unquoted `nullMarker` field is NULL. */
export function parseCsv(text: string, nullMarker: string): QueryResult {
  const records: (string | null)[][] = [];
  let field = "";
  let wasQuoted = false;
  let row: (string | null)[] = [];
  let quoted = false;
  const endField = () => {
    row.push(field === nullMarker && !wasQuoted ? null : field);
    field = "";
    wasQuoted = false;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') (quoted = true), (wasQuoted = true);
    else if (ch === ",") endField();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endField(), records.push(row), (row = []);
    } else field += ch;
  }
  if (field || wasQuoted || row.length) endField(), records.push(row);
  const [header = [], ...data] = records;
  const columns = header.map((h) => h ?? "");
  return { columns, rows: data.map((r) => Object.fromEntries(columns.map((h, i) => [h, r[i] ?? null]))) };
}
