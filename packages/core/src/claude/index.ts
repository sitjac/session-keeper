import fs from "node:fs/promises";
import path from "node:path";

import type { SessionTranscript } from "@session-keeper/shared";
import { CLAUDE_HISTORY_FILENAME } from "@session-keeper/shared";

import { parseClaudeTranscript } from "./transcript.js";

export type { ClaudeSessionFile } from "./files.js";
export { decodeClaudeProjectDir, discoverClaudeSessionFiles } from "./files.js";
export type { ClaudeIngestResult } from "./ingest.js";
export { ingestClaudeFile } from "./ingest.js";
export { parseClaudeTranscript } from "./transcript.js";
export { appendClaudeAiTitle, removeClaudeHistory, updateClaudeHistory } from "./writeback.js";

export async function readClaudeTranscript(filePath: string): Promise<SessionTranscript> {
  const raw = await fs.readFile(filePath, "utf8");
  return parseClaudeTranscript(raw);
}

export function claudeHistoryPath(claudeHome: string): string {
  return path.join(claudeHome, CLAUDE_HISTORY_FILENAME);
}
