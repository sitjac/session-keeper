import fs from "node:fs/promises";
import path from "node:path";

import { ensureTrailingNewline } from "../util.js";

/**
 * Append an `ai-title` event to a Claude session jsonl, overriding the
 * displayed title. Mirrors how Codex appends `thread_name_updated` events.
 */
export async function appendClaudeAiTitle(params: {
  filePath: string;
  sessionId: string;
  title: string;
}): Promise<void> {
  const event = {
    type: "ai-title",
    aiTitle: params.title,
    sessionId: params.sessionId,
  };
  await fs.mkdir(path.dirname(params.filePath), { recursive: true });
  await fs.appendFile(params.filePath, `${JSON.stringify(event)}\n`, "utf8");
}

interface HistoryEntry {
  display?: string;
  sessionId?: string;
  [key: string]: unknown;
}

/**
 * Rewrite `history.jsonl` so the matching session's `display` field reflects
 * the new title. Uses an atomic tmp-write + rename to avoid partial writes.
 */
export async function updateClaudeHistory(params: {
  historyPath: string;
  sessionId: string;
  title: string;
}): Promise<{ written: boolean; updated: number }> {
  let content = "";
  try {
    content = await fs.readFile(params.historyPath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return { written: false, updated: 0 };
    }
    throw error;
  }

  const lines = content.split(/\r?\n/);
  let updated = 0;
  const nextLines = lines.map((line) => {
    if (line.trim().length === 0) {
      return line;
    }
    try {
      const entry = JSON.parse(line) as HistoryEntry;
      if (entry.sessionId === params.sessionId) {
        if (entry.display === params.title) {
          return line;
        }
        updated += 1;
        return JSON.stringify({ ...entry, display: params.title });
      }
      return line;
    } catch {
      return line;
    }
  });

  if (updated === 0) {
    return { written: false, updated: 0 };
  }

  const nextContent = ensureTrailingNewline(nextLines.join("\n"));
  await fs.mkdir(path.dirname(params.historyPath), { recursive: true });
  const tmpPath = `${params.historyPath}.tmp-${Date.now()}`;
  await fs.writeFile(tmpPath, nextContent, "utf8");
  await fs.rename(tmpPath, params.historyPath);

  return { written: true, updated };
}

/**
 * Remove the history.jsonl entries for a deleted session, so Claude CLI
 * `/resume` no longer lists it. Atomic tmp-write + rename.
 */
export async function removeClaudeHistory(params: {
  historyPath: string;
  sessionId: string;
}): Promise<{ written: boolean; removed: number }> {
  let content = "";
  try {
    content = await fs.readFile(params.historyPath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return { written: false, removed: 0 };
    }
    throw error;
  }

  const lines = content.split(/\r?\n/);
  let removed = 0;
  const nextLines = lines.filter((line) => {
    if (line.trim().length === 0) {
      return true;
    }
    try {
      const entry = JSON.parse(line) as HistoryEntry;
      if (entry.sessionId === params.sessionId) {
        removed += 1;
        return false;
      }
      return true;
    } catch {
      return true;
    }
  });

  if (removed === 0) {
    return { written: false, removed: 0 };
  }

  const nextContent = ensureTrailingNewline(nextLines.join("\n"));
  await fs.mkdir(path.dirname(params.historyPath), { recursive: true });
  const tmpPath = `${params.historyPath}.tmp-${Date.now()}`;
  await fs.writeFile(tmpPath, nextContent, "utf8");
  await fs.rename(tmpPath, params.historyPath);

  return { written: true, removed };
}
