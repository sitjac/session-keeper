import fs from "node:fs/promises";
import path from "node:path";

import type { MaterializedSession } from "@session-keeper/shared";

import type { IngestCursorRecord } from "../rollout.js";
import { basenameSafe, excerpt, normalizeWhitespace, stripControl } from "../util.js";

interface ClaudeEvent {
  type?: string;
  timestamp?: string;
  sessionId?: string;
  message?: Record<string, unknown>;
  aiTitle?: string;
  lastPrompt?: string;
  requestedModel?: string;
  cwd?: string;
}

export interface ClaudeIngestResult {
  session?: MaterializedSession;
  cursor: IngestCursorRecord;
}

function contentToText(content: unknown): string | undefined {
  if (typeof content === "string") {
    return normalizeWhitespace(stripControl(content));
  }

  if (Array.isArray(content)) {
    const parts = content
      .filter(
        (block): block is Record<string, unknown> => Boolean(block) && typeof block === "object",
      )
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .filter((value): value is string => typeof value === "string");
    return normalizeWhitespace(stripControl(parts.join("\n")));
  }

  return undefined;
}

function mergeEventIntoSession(session: MaterializedSession, event: ClaudeEvent): void {
  if (event.timestamp) {
    session.updatedAt = event.timestamp;
  }

  if (event.cwd) {
    session.cwd = event.cwd;
    session.projectName = basenameSafe(event.cwd);
  }

  switch (event.type) {
    case "ai-title": {
      const title = normalizeWhitespace(stripControl(event.aiTitle));
      if (title) {
        session.threadName = title;
        session.threadNameUpdatedAt = event.timestamp ?? session.threadNameUpdatedAt;
      }
      break;
    }
    case "last-prompt": {
      const prompt = excerpt(stripControl(event.lastPrompt), 200);
      if (prompt) {
        session.lastUserMessage = prompt;
        if (!session.firstUserMessage) {
          session.firstUserMessage = prompt;
        }
      }
      break;
    }
    case "user": {
      const message = event.message;
      const text = contentToText(message?.content);
      if (text) {
        if (!session.createdAt) {
          session.createdAt = event.timestamp;
        }
        if (!session.firstUserMessage) {
          session.firstUserMessage = excerpt(text, 200);
        }
        if (text !== session.lastUserMessage) {
          session.lastUserMessage = excerpt(text, 200);
        }
      }
      break;
    }
    case "assistant": {
      const message = event.message;
      const text = contentToText(message?.content);
      if (event.requestedModel) {
        session.model = event.requestedModel;
      }
      if (text && text !== session.lastAgentMessage) {
        session.lastAgentMessage = excerpt(text, 240);
      }
      break;
    }
    default:
      break;
  }
}

export async function ingestClaudeFile(params: {
  path: string;
  stat?: { size: number; mtime: Date };
  previousSession?: MaterializedSession;
  previousCursor?: IngestCursorRecord;
}): Promise<ClaudeIngestResult> {
  const stat = params.stat ?? (await fs.stat(params.path));
  const previousCursor = params.previousCursor;
  const startOffset =
    previousCursor && previousCursor.lastOffset <= stat.size ? previousCursor.lastOffset : 0;

  const handle = await fs.open(params.path, "r");
  const buffer = Buffer.alloc(Math.max(0, stat.size - startOffset));
  try {
    if (buffer.length > 0) {
      await handle.read(buffer, 0, buffer.length, startOffset);
    }
  } finally {
    await handle.close();
  }

  const text = buffer.toString("utf8");
  const lastNewline = text.lastIndexOf("\n");
  const processable =
    lastNewline >= 0 ? text.slice(0, lastNewline + 1) : startOffset === 0 ? text : "";
  const nextOffset =
    lastNewline >= 0
      ? startOffset + Buffer.byteLength(processable, "utf8")
      : startOffset === 0
        ? stat.size
        : startOffset;

  const session: MaterializedSession = params.previousSession
    ? { ...params.previousSession }
    : {
        threadId: path.basename(params.path, path.extname(params.path)),
        rolloutPath: params.path,
        source: "claude",
        taskCompleteCount: 0,
        tokenTotal: 0,
      };

  for (const line of processable.split(/\r?\n/)) {
    if (line.trim().length === 0) {
      continue;
    }
    try {
      const event = JSON.parse(line) as ClaudeEvent;
      mergeEventIntoSession(session, event);
    } catch {
      continue;
    }
  }

  session.rolloutPath = params.path;
  session.source = "claude";
  if (!session.projectName) {
    session.projectName = basenameSafe(session.cwd);
  }

  return {
    session: session.threadId ? session : undefined,
    cursor: {
      rolloutPath: params.path,
      lastOffset: nextOffset === 0 ? stat.size : nextOffset,
      lastSize: stat.size,
      lastMtime: stat.mtime.toISOString(),
      lastScanAt: new Date().toISOString(),
    },
  };
}
