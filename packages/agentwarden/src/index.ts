/**
 * agentwarden — let AI agents from one department query another department's database safely.
 *
 *   import { AgentWardenClient } from "agentwarden";          // agent side
 *   import { createGateway, pgliteDatabase } from "agentwarden/gateway"; // database side
 *   import { gemini, ollama } from "agentwarden/models";       // the agent's AI model
 */
export { AgentWardenClient, type ClientOptions, type ConnectResult, type AskResult } from "./client";
export { gemini, ollama, openrouter, builtin, type AgentModel } from "./models";
export type { TraceStep, QueryResponse, ConnectResponse, CatalogTable, Layer, StepStatus } from "./shared/types";
export type { PuzzleStep, Challenge } from "./shared/challenge";
