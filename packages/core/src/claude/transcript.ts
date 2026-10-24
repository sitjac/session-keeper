import type {
  SessionTranscript,
  SessionTranscriptAttachment,
  SessionTranscriptEntry,
  SessionTranscriptRole,
} from "@session-keeper/shared";

interface ClaudeEvent {
  type?: string;
  timestamp?: string;
  message?: Record<string, unknown>;
  aiTitle?: string;
  lastPrompt?: string;
  attachment?: Record<string, unknown>;
  rendered?: Array<Record<string, unknown>>;
  renderedRole?: string;
}

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  source?: Record<string, unknown>;
}

// 保留换行的文本规范化，与 Codex 的 parseSessionTranscript 对齐：
// markdown 的代码块/列表/表格/分段依赖换行来切分，压扁会破坏格式化。
function normalizeTranscriptText(input: unknown): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }

  const normalized = input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .trim();

  return normalized.length > 0 ? normalized : undefined;
}

function contentText(content: unknown): string {
  if (typeof content === "string") {
    return normalizeTranscriptText(content) ?? "";
  }

  if (Array.isArray(content)) {
    return (
      normalizeTranscriptText(
        content
          .filter((block): block is ContentBlock => Boolean(block) && typeof block === "object")
          .filter((block) => block.type === "text")
          .map((block) => block.text ?? "")
          .filter((value): value is string => typeof value === "string")
          .join("\n"),
      ) ?? ""
    );
  }

  return "";
}

function imageAttachments(content: unknown): SessionTranscriptAttachment[] {
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .filter((block): block is ContentBlock => Boolean(block) && typeof block === "object")
    .filter((block) => block.type === "image")
    .map((block) => {
      const source = (block.source ?? {}) as Record<string, unknown>;
      const imageUrl =
        typeof source.data === "string"
          ? source.data
          : typeof source.url === "string"
            ? source.url
            : undefined;
      return {
        kind: "image" as const,
        imageUrl: imageUrl ?? "",
        ...(block.name ? { name: block.name } : {}),
      };
    });
}

function extractToolCalls(
  content: unknown,
): Array<{ name: string; callId: string; input: string }> {
  if (!Array.isArray(content)) {
    return [];
  }
  const calls: Array<{ name: string; callId: string; input: string }> = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const record = block as ContentBlock;
    if (record.type === "tool_use") {
      const input = record.input ?? {};
      const inputText = normalizeTranscriptText(JSON.stringify(input, null, 2)) ?? "";
      calls.push({
        name: record.name ?? "tool",
        callId: record.id ?? "",
        input: inputText,
      });
    }
  }
  return calls;
}

function extractToolOutputs(content: unknown): Array<{ callId: string; output: string }> {
  if (!Array.isArray(content)) {
    return [];
  }
  const outputs: Array<{ callId: string; output: string }> = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const record = block as Record<string, unknown>;
    if (record.type === "tool_result") {
      const content = record.content as unknown;
      const output =
        normalizeTranscriptText(
          typeof content === "string" ? content : JSON.stringify(content, null, 2),
        ) ?? "";
      outputs.push({
        callId: typeof record.tool_use_id === "string" ? record.tool_use_id : "",
        output,
      });
    }
  }
  return outputs;
}

function shouldHideText(text: string): boolean {
  return (
    text.includes("AGENTS.md instructions") ||
    text.includes("<environment_context>") ||
    text.includes("<system-reminder>")
  );
}

function entryId(index: number, fallback: string): string {
  return `${String(index).padStart(6, "0")}-${fallback}`;
}

export function parseClaudeTranscript(raw: string): SessionTranscript {
  const items: SessionTranscriptEntry[] = [];

  const push = (entry: Omit<SessionTranscriptEntry, "id">): void => {
    items.push({
      id: entryId(items.length + 1, entry.callId ?? entry.kind),
      ...entry,
    });
  };

  for (const line of raw.split(/\r?\n/)) {
    if (line.trim().length === 0) {
      continue;
    }

    let event: ClaudeEvent;
    try {
      event = JSON.parse(line) as ClaudeEvent;
    } catch {
      continue;
    }

    if (event.type === "user") {
      const content = event.message?.content;
      const text = contentText(content);
      const attachments = imageAttachments(content);
      const toolOutputs = extractToolOutputs(content);

      if (toolOutputs.length > 0) {
        for (const output of toolOutputs) {
          push({
            timestamp: event.timestamp,
            role: "tool",
            kind: "tool_output",
            callId: output.callId,
            content: output.output,
          });
        }
      }

      if (text || attachments.length > 0) {
        push({
          timestamp: event.timestamp,
          role: "user",
          kind: "message",
          content: text,
          ...(attachments.length > 0 ? { attachments } : {}),
          hidden: shouldHideText(text),
          hiddenReason: shouldHideText(text) ? "bootstrap_context" : undefined,
        });
      }
      continue;
    }

    if (event.type === "assistant") {
      const content = event.message?.content;
      const text = contentText(content);
      const toolCalls = extractToolCalls(content);
      const toolOutputs = extractToolOutputs(content);

      if (toolCalls.length > 0 || toolOutputs.length > 0) {
        for (const call of toolCalls) {
          push({
            timestamp: event.timestamp,
            role: "tool",
            kind: "tool_call",
            name: call.name,
            callId: call.callId,
            content: call.input,
          });
        }
        for (const output of toolOutputs) {
          push({
            timestamp: event.timestamp,
            role: "tool",
            kind: "tool_output",
            callId: output.callId,
            content: output.output,
          });
        }
      }

      if (text) {
        push({
          timestamp: event.timestamp,
          role: "assistant",
          kind: "message",
          content: text,
        });
      }
      continue;
    }

    if (event.type === "attachment") {
      const attachment = event.attachment ?? {};
      if (attachment.type === "image") {
        // Image attachments are surfaced through user/assistant content blocks;
        // the standalone attachment event is skipped to avoid duplication.
      }
      continue;
    }

    if (event.type === "ai-title") {
      continue;
    }
  }

  const roleCount = (role: SessionTranscriptRole) => items.filter((i) => i.role === role).length;
  return {
    items,
    counts: {
      total: items.length,
      visible: items.filter((item) => !item.hidden).length,
      hidden: items.filter((item) => item.hidden).length,
      tools: roleCount("tool"),
    },
  };
}
