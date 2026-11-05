import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchSessionTranscript, sendSessionMessage } from "./api.js";
import { transcriptTone } from "./browser-utils.js";
import { copyTextToClipboard } from "./clipboard.js";
import type { UiLanguage } from "./i18n.js";
import { t, transcriptRoleLabel } from "./i18n.js";
import type {
  SessionDetail,
  SessionTranscriptAttachment,
  SessionTranscriptEntry,
  SessionTranscriptPage,
} from "./types.js";

const TRANSCRIPT_PAGE_SIZE = 30;
const COPY_FEEDBACK_MS = 1_600;

type CopyState = "copied" | "failed" | "idle";

type MessageGroup = {
  type: "thinking" | "response";
  messages: SessionTranscriptEntry[];
  id: string;
};

type MarkdownBlock =
  | { type: "blockquote"; lines: string[] }
  | { type: "code"; content: string; language?: string }
  | { type: "heading"; content: string; level: 1 | 2 | 3 }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "paragraph"; lines: string[] }
  | { type: "table"; header: string[]; rows: string[][] };

function readableError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(error.message) as { message?: unknown };
    return typeof parsed.message === "string" ? parsed.message : error.message;
  } catch {
    return error.message;
  }
}

function isFence(line: string): RegExpMatchArray | null {
  return line.match(/^\s*```([\w-]*)\s*$/);
}

function parseListItem(line: string): { ordered: boolean; text: string } | null {
  const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
  if (unordered) {
    return { ordered: false, text: unordered[1] ?? "" };
  }

  const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
  if (ordered) {
    return { ordered: true, text: ordered[1] ?? "" };
  }

  return null;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableStart(lines: string[], index: number): boolean {
  const row = lines[index];
  const divider = lines[index + 1];
  return Boolean(row?.includes("|") && divider && isTableDivider(divider));
}

function startsNewBlock(line: string): boolean {
  return Boolean(
    isFence(line) || line.match(/^#{1,3}\s+\S/) || line.match(/^>\s?/) || parseListItem(line),
  );
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n?/g, "\n").trimEnd().split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined) {
      break;
    }
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = isFence(line);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length) {
        const codeLine = lines[index];
        if (codeLine === undefined || isFence(codeLine)) {
          break;
        }
        codeLines.push(codeLine);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({
        type: "code",
        language: fence[1] || undefined,
        content: codeLines.join("\n"),
      });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: (heading[1]?.length ?? 1) as 1 | 2 | 3,
        content: heading[2] ?? "",
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const quoteLine = lines[index];
        if (quoteLine === undefined || !/^>\s?/.test(quoteLine)) {
          break;
        }
        quoteLines.push(quoteLine.replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    const listItem = parseListItem(line);
    if (listItem) {
      const items: string[] = [];
      const ordered = listItem.ordered;
      while (index < lines.length) {
        const itemLine = lines[index];
        const nextItem = itemLine === undefined ? null : parseListItem(itemLine);
        if (!nextItem || nextItem.ordered !== ordered) {
          break;
        }
        items.push(nextItem.text);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (isTableStart(lines, index)) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length) {
        const tableLine = lines[index];
        if (tableLine === undefined || !tableLine.trim() || !tableLine.includes("|")) {
          break;
        }
        rows.push(splitTableRow(tableLine));
        index += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index];
      if (paragraphLine === undefined || !paragraphLine.trim() || startsNewBlock(paragraphLine)) {
        break;
      }
      paragraphLines.push(paragraphLine);
      index += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraphLines });
  }

  return blocks;
}

function safeHref(rawHref: string): string | undefined {
  const href = rawHref.trim();
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(href)) {
    return href;
  }
  return undefined;
}

function appendPlainText(nodes: ReactNode[], text: string, keyPrefix: string): void {
  text.split("\n").forEach((part, index) => {
    if (index > 0) {
      nodes.push(<br key={`${keyPrefix}-br-${index}`} />);
    }
    if (part) {
      nodes.push(part);
    }
  });
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(`[^`\n]+`|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|\[[^\]\n]+\]\([^) \n]+\))/g;
  let cursor = 0;
  let match = tokenPattern.exec(text);

  while (match !== null) {
    if (match.index > cursor) {
      appendPlainText(nodes, text.slice(cursor, match.index), `${keyPrefix}-text-${cursor}`);
    }

    const token = match[0] ?? "";
    const nodeKey = `${keyPrefix}-token-${match.index}`;

    if (token.startsWith("`")) {
      nodes.push(<code key={nodeKey}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={nodeKey}>{renderInline(token.slice(2, -2), nodeKey)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={nodeKey}>{renderInline(token.slice(1, -1), nodeKey)}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = link?.[2] ? safeHref(link[2]) : undefined;
      nodes.push(
        href ? (
          <a href={href} key={nodeKey} rel="noreferrer" target="_blank">
            {renderInline(link?.[1] ?? href, nodeKey)}
          </a>
        ) : (
          token
        ),
      );
    }

    cursor = match.index + token.length;
    match = tokenPattern.exec(text);
  }

  if (cursor < text.length) {
    appendPlainText(nodes, text.slice(cursor), `${keyPrefix}-text-${cursor}`);
  }

  return nodes;
}

function renderBlock(block: MarkdownBlock, index: number, uiLanguage: UiLanguage): ReactNode {
  switch (block.type) {
    case "blockquote":
      return (
        <CopyableMarkdownBlock
          idleLabel={t(uiLanguage, "copyBlock")}
          key={index}
          text={formatBlockquoteCopyText(block)}
          uiLanguage={uiLanguage}
        >
          <blockquote>{renderInline(block.lines.join("\n"), `quote-${index}`)}</blockquote>
        </CopyableMarkdownBlock>
      );
    case "code":
      return <MarkdownCodeBlock block={block} key={index} uiLanguage={uiLanguage} />;
    case "heading":
      if (block.level === 1) {
        return <h3 key={index}>{renderInline(block.content, `heading-${index}`)}</h3>;
      }
      if (block.level === 2) {
        return <h4 key={index}>{renderInline(block.content, `heading-${index}`)}</h4>;
      }
      return <h5 key={index}>{renderInline(block.content, `heading-${index}`)}</h5>;
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `list-${index}-${itemIndex}`)}</li>
          ))}
        </ListTag>
      );
    }
    case "paragraph":
      return <p key={index}>{renderInline(block.lines.join("\n"), `paragraph-${index}`)}</p>;
    case "table":
      return (
        <CopyableMarkdownBlock
          idleLabel={t(uiLanguage, "copyBlock")}
          key={index}
          text={formatTableCopyText(block)}
          uiLanguage={uiLanguage}
        >
          <div className="markdown-table-scroller">
            <table>
              <thead>
                <tr>
                  {block.header.map((cell, cellIndex) => (
                    <th key={cellIndex}>
                      {renderInline(cell, `table-${index}-head-${cellIndex}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>
                        {renderInline(cell, `table-${index}-${rowIndex}-${cellIndex}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CopyableMarkdownBlock>
      );
    default:
      return null;
  }
}

function formatBlockquoteCopyText(block: Extract<MarkdownBlock, { type: "blockquote" }>): string {
  return block.lines.map((line) => `> ${line}`).join("\n");
}

function formatTableCopyText(block: Extract<MarkdownBlock, { type: "table" }>): string {
  const rowText = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const divider = block.header.map(() => "---");
  return [block.header, divider, ...block.rows].map(rowText).join("\n");
}

function basenameFromPath(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.split(/[\\/]/).filter(Boolean).pop();
}

function attachmentLabel(attachment: SessionTranscriptAttachment, uiLanguage: UiLanguage): string {
  return (
    attachment.name?.trim() || basenameFromPath(attachment.path) || t(uiLanguage, "imageAttachment")
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" className="turn-copy-icon" focusable="false" viewBox="0 0 24 24">
      <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="turn-check-icon" focusable="false" viewBox="0 0 20 20">
      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
    </svg>
  );
}

function useClipboardFeedback() {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    if (copyState === "idle") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setCopyState("idle");
    }, COPY_FEEDBACK_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copyState]);

  const copyText = async (text: string) => {
    try {
      await copyTextToClipboard(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return { copyState, copyText };
}

function MarkdownCodeBlock(props: {
  block: Extract<MarkdownBlock, { type: "code" }>;
  uiLanguage: UiLanguage;
}) {
  const language = props.block.language?.trim();

  return (
    <div className="markdown-code-block-shell">
      <div className="markdown-code-block-toolbar">
        {language ? <span className="markdown-code-language">{language}</span> : null}
        <BlockCopyButton
          idleLabel={t(props.uiLanguage, "copyCodeBlock")}
          text={props.block.content}
          uiLanguage={props.uiLanguage}
        />
      </div>
      <pre className="markdown-code-block">
        <code data-language={language}>{props.block.content}</code>
      </pre>
    </div>
  );
}

function BlockCopyButton(props: { idleLabel: string; text: string; uiLanguage: UiLanguage }) {
  const { copyState, copyText } = useClipboardFeedback();
  const label =
    copyState === "copied"
      ? t(props.uiLanguage, "copiedMessage")
      : copyState === "failed"
        ? t(props.uiLanguage, "copyMessageFailed")
        : props.idleLabel;
  const visibleLabel = copyState === "idle" ? t(props.uiLanguage, "copyMessage") : label;

  return (
    <button
      aria-label={label}
      className="markdown-block-copy-button"
      disabled={!props.text}
      onClick={() => void copyText(props.text)}
      title={label}
      type="button"
    >
      {copyState === "copied" ? <CheckIcon /> : <CopyIcon />}
      <span>{visibleLabel}</span>
    </button>
  );
}

function CopyableMarkdownBlock(props: {
  children: ReactNode;
  idleLabel: string;
  text: string;
  uiLanguage: UiLanguage;
}) {
  return (
    <div className="markdown-copyable-block">
      <div className="markdown-copyable-block-actions">
        <BlockCopyButton
          idleLabel={props.idleLabel}
          text={props.text}
          uiLanguage={props.uiLanguage}
        />
      </div>
      {props.children}
    </div>
  );
}

function cleanImageMarkers(content: string): string {
  // Remove [Image #N] markers
  let cleaned = content.replace(/\[Image #\d+\]/g, "");
  // Remove [Image: source: ...] markers
  cleaned = cleaned.replace(/\[Image: source: [^\]]+\]/g, "");
  return cleaned.trim();
}

function MarkdownMessage(props: {
  attachments?: SessionTranscriptAttachment[];
  content: string;
  onPreviewAttachment: (attachment: SessionTranscriptAttachment) => void;
  uiLanguage: UiLanguage;
}) {
  const cleanedContent = useMemo(() => cleanImageMarkers(props.content), [props.content]);
  const blocks = useMemo(() => parseMarkdownBlocks(cleanedContent), [cleanedContent]);

  // Don't render if no content and no attachments
  if (!cleanedContent && !props.attachments?.length) {
    return null;
  }

  return (
    <div className="turn-body message-markdown">
      {cleanedContent && (
        <div className="message-markdown-content">
          {blocks.map((block, index) => renderBlock(block, index, props.uiLanguage))}
        </div>
      )}
      {props.attachments?.length ? (
        <div className="message-attachments">
          {props.attachments.map((attachment, index) => (
            <AttachmentPreview
              attachment={attachment}
              key={`${attachment.name ?? attachment.path ?? "attachment"}-${index}`}
              onPreview={props.onPreviewAttachment}
              uiLanguage={props.uiLanguage}
            />
          ))}
        </div>
      ) : null}
      {cleanedContent && (
        <div className="turn-footer">
          <MessageCopyButton markdownContent={cleanedContent} uiLanguage={props.uiLanguage} />
        </div>
      )}
    </div>
  );
}

function AttachmentPreview(props: {
  attachment: SessionTranscriptAttachment;
  onPreview: (attachment: SessionTranscriptAttachment) => void;
  uiLanguage: UiLanguage;
}) {
  const label = attachmentLabel(props.attachment, props.uiLanguage);

  return (
    <button
      aria-label={`${label} ${t(props.uiLanguage, "imageAttachmentPreview")}`}
      className="message-attachment"
      onClick={() => props.onPreview(props.attachment)}
      title={label}
      type="button"
    >
      <img
        alt={label}
        className="message-attachment-thumb"
        loading="lazy"
        src={props.attachment.imageUrl}
      />
      <div className="message-attachment-text">
        <span className="message-attachment-name">{label}</span>
      </div>
    </button>
  );
}

function ImageLightbox(props: {
  attachment: SessionTranscriptAttachment;
  uiLanguage: UiLanguage;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [props.onClose]);

  const label = attachmentLabel(props.attachment, props.uiLanguage);

  return (
    <div aria-label={label} aria-modal="true" className="attachment-lightbox" role="dialog">
      <button
        aria-label={t(props.uiLanguage, "closePreview")}
        className="attachment-lightbox-backdrop"
        onClick={props.onClose}
        type="button"
      />
      <div className="attachment-lightbox-panel">
        <button
          aria-label={t(props.uiLanguage, "closePreview")}
          className="attachment-lightbox-close"
          onClick={props.onClose}
          type="button"
        >
          ×
        </button>
        <img alt={label} className="attachment-lightbox-image" src={props.attachment.imageUrl} />
        <div className="attachment-lightbox-caption">{label}</div>
      </div>
    </div>
  );
}

function MessageCopyButton(props: { markdownContent: string; uiLanguage: UiLanguage }) {
  const { copyState, copyText } = useClipboardFeedback();

  const label =
    copyState === "copied"
      ? t(props.uiLanguage, "copiedMessage")
      : copyState === "failed"
        ? t(props.uiLanguage, "copyMessageFailed")
        : t(props.uiLanguage, "copyMarkdownMessage");

  const handleCopy = async () => {
    await copyText(props.markdownContent);
  };

  return (
    <button
      aria-label={label}
      className="turn-copy-button"
      disabled={!props.markdownContent}
      onClick={() => void handleCopy()}
      title={label}
      type="button"
    >
      {copyState === "copied" ? <CheckIcon /> : <CopyIcon />}
      <span className="turn-copy-format">MD</span>
    </button>
  );
}

function groupMessages(items: SessionTranscriptEntry[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let groupIndex = 0;
  let i = 0;

  while (i < items.length) {
    const item = items[i];
    if (!item) {
      i++;
      continue;
    }

    // User messages are always shown as response
    if (item.role === "user") {
      groups.push({
        type: "response",
        messages: [item],
        id: `group-${groupIndex++}`,
      });
      i++;
      continue;
    }

    // Collect consecutive assistant messages and tool calls
    if (item.role === "assistant" || item.role === "tool") {
      const turnMessages: SessionTranscriptEntry[] = [];
      while (i < items.length && (items[i]?.role === "assistant" || items[i]?.role === "tool")) {
        const msg = items[i];
        if (msg) turnMessages.push(msg);
        i++;
      }

      // Find the last assistant message (not tool call/output)
      let lastAssistantIndex = -1;
      for (let j = turnMessages.length - 1; j >= 0; j--) {
        const msg = turnMessages[j];
        if (msg?.role === "assistant" && msg.kind === "message") {
          lastAssistantIndex = j;
          break;
        }
      }

      // If only one message total and it's an assistant message, show it directly
      if (turnMessages.length === 1 && lastAssistantIndex === 0) {
        groups.push({
          type: "response",
          messages: turnMessages,
          id: `group-${groupIndex++}`,
        });
      } else if (lastAssistantIndex >= 0) {
        // Multiple messages: fold everything except the last assistant message
        const lastAssistantMessage = turnMessages[lastAssistantIndex];
        const thinkingMessages = turnMessages.filter((_, index) => index !== lastAssistantIndex);

        if (thinkingMessages.length > 0) {
          groups.push({
            type: "thinking",
            messages: thinkingMessages,
            id: `group-${groupIndex++}`,
          });
        }

        if (lastAssistantMessage) {
          groups.push({
            type: "response",
            messages: [lastAssistantMessage],
            id: `group-${groupIndex++}`,
          });
        }
      } else if (turnMessages.length > 0) {
        // No assistant message, only tools - show all as thinking
        groups.push({
          type: "thinking",
          messages: turnMessages,
          id: `group-${groupIndex++}`,
        });
      }
      continue;
    }

    i++;
  }

  return groups;
}

function formatToolContent(content: string): string {
  try {
    // Try to parse as JSON and format it
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // If not JSON, return as is
    return content;
  }
}

function ToolCallMessage(props: { item: SessionTranscriptEntry; uiLanguage: UiLanguage }) {
  const isToolCall = props.item.kind === "tool_call";
  const label = isToolCall
    ? props.uiLanguage === "zh-CN"
      ? "执行命令"
      : "Tool Call"
    : props.uiLanguage === "zh-CN"
      ? "执行结果"
      : "Tool Output";

  const formattedContent = useMemo(
    () => formatToolContent(props.item.content),
    [props.item.content],
  );

  return (
    <div className="tool-message">
      <div className="tool-message-header">
        <span className="tool-message-label">{label}</span>
        {props.item.name && <span className="tool-message-name">{props.item.name}</span>}
      </div>
      <pre className="tool-message-content">{formattedContent}</pre>
    </div>
  );
}

function ThinkingChain(props: {
  group: MessageGroup;
  uiLanguage: UiLanguage;
  onPreviewAttachment: (attachment: SessionTranscriptAttachment) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const messageCount = props.group.messages.length;
  const previewText = props.group.messages[0]?.content.slice(0, 100) || "";

  return (
    <div className="thinking-chain">
      <button className="thinking-chain-header" onClick={props.onToggle} type="button">
        <span className="thinking-chain-icon">{props.expanded ? "▼" : "▶"}</span>
        <span className="thinking-chain-label">
          {props.uiLanguage === "zh-CN" ? "思考过程" : "Thinking"} ({messageCount})
        </span>
        {!props.expanded && <span className="thinking-chain-preview">{previewText}...</span>}
      </button>
      {props.expanded && (
        <div className="thinking-chain-content">
          {props.group.messages.map((item) => {
            if (item.kind === "tool_call" || item.kind === "tool_output") {
              return <ToolCallMessage item={item} key={item.id} uiLanguage={props.uiLanguage} />;
            }
            return (
              <article className="message-turn" data-role={item.role} key={item.id}>
                <MarkdownMessage
                  attachments={item.attachments}
                  content={item.content}
                  onPreviewAttachment={props.onPreviewAttachment}
                  uiLanguage={props.uiLanguage}
                />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TranscriptPanel(props: {
  detail: SessionDetail;
  transcriptRefreshToken?: number;
  uiLanguage: UiLanguage;
  onConversationSettled?: () => void | Promise<void>;
}) {
  const [pageState, setPageState] = useState<SessionTranscriptPage | null>(null);
  const [items, setItems] = useState<SessionTranscriptPage["items"]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [previewedAttachment, setPreviewedAttachment] =
    useState<SessionTranscriptAttachment | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number>(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void fetchSessionTranscript(props.detail.threadId, {
      page: 1,
      pageSize: TRANSCRIPT_PAGE_SIZE,
      includeHidden: false,
      role: "all",
    })
      .then((payload) => {
        if (!active) {
          return;
        }
        setPageState(payload);
        setItems(
          payload.items.filter(
            (item) =>
              (item.kind === "message" ||
                item.kind === "tool_call" ||
                item.kind === "tool_output") &&
              item.role !== "system",
          ),
        );
      })
      .catch((nextError) => {
        if (!active) {
          return;
        }
        setError(readableError(nextError, "Failed to load transcript"));
        setPageState(null);
        setItems([]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [props.detail.threadId, props.transcriptRefreshToken, reloadToken]);

  const loadEarlier = useCallback(async () => {
    if (!pageState?.hasMore || loading) {
      return;
    }

    // Save current scroll height before loading
    if (messagesContainerRef.current) {
      previousScrollHeightRef.current = messagesContainerRef.current.scrollHeight;
    }

    setLoading(true);
    setError(null);
    try {
      const nextPage = await fetchSessionTranscript(props.detail.threadId, {
        page: pageState.page + 1,
        pageSize: pageState.pageSize,
        includeHidden: false,
        role: "all",
      });
      setItems((previous) => [
        ...nextPage.items.filter(
          (item) =>
            (item.kind === "message" || item.kind === "tool_call" || item.kind === "tool_output") &&
            item.role !== "system",
        ),
        ...previous,
      ]);
      setPageState(nextPage);
    } catch (nextError) {
      setError(readableError(nextError, "Failed to load transcript"));
      isLoadingEarlierRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [pageState, loading, props.detail.threadId]);

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) {
      return;
    }

    const pendingId = `pending-${Date.now()}`;
    setDraft("");
    setError(null);
    setSending(true);
    setItems((previous) => [
      ...previous,
      {
        id: pendingId,
        role: "user",
        kind: "message",
        content: message,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      await sendSessionMessage(props.detail.threadId, message);
      await props.onConversationSettled?.();
      setReloadToken((previous) => previous + 1);
    } catch (nextError) {
      setItems((previous) => previous.filter((item) => item.id !== pendingId));
      setDraft(message);
      setError(readableError(nextError, "Failed to send message"));
    } finally {
      setSending(false);
    }
  };

  const totalShown = items.length;
  const hiddenOlderCount = Math.max(0, (pageState?.totalItems ?? 0) - totalShown);
  const tt = (key: Parameters<typeof t>[1]) => t(props.uiLanguage, key);
  const messageGroups = useMemo(() => groupMessages(items), [items]);
  const isLoadingEarlierRef = useRef(false);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Restore scroll position after loading earlier messages
  useEffect(() => {
    if (messagesContainerRef.current && previousScrollHeightRef.current > 0) {
      const container = messagesContainerRef.current;
      const newScrollHeight = container.scrollHeight;
      const scrollDiff = newScrollHeight - previousScrollHeightRef.current;

      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        container.scrollTop = scrollDiff;
        previousScrollHeightRef.current = 0;
        isLoadingEarlierRef.current = false;
      });
    }
  }, [items]);

  // Handle scroll to top for auto-loading with debounce
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    let scrollTimer: number | undefined;

    const onScroll = () => {
      // Clear previous timer
      if (scrollTimer !== undefined) {
        window.clearTimeout(scrollTimer);
      }

      // Debounce scroll event
      scrollTimer = window.setTimeout(() => {
        if (isLoadingEarlierRef.current || loading || !pageState?.hasMore) {
          return;
        }

        const { scrollTop } = container;
        // Trigger load when scrolled very close to top (within 50px)
        if (scrollTop < 50 && scrollTop >= 0) {
          isLoadingEarlierRef.current = true;
          void loadEarlier();
        }
      }, 150);
    };

    container.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", onScroll);
      if (scrollTimer !== undefined) {
        window.clearTimeout(scrollTimer);
      }
    };
  }, [loading, pageState?.hasMore, loadEarlier]);

  return (
    <section className="chat-view-shell">
      <div className="chat-messages" ref={messagesContainerRef}>
        {pageState?.hasMore ? (
          <div className="load-more">
            <button className="btn-sm" onClick={() => void loadEarlier()} type="button">
              {loading
                ? tt("loading")
                : `${tt("loadEarlierMessages")} (${Math.min(hiddenOlderCount, pageState.pageSize)})`}
            </button>
          </div>
        ) : null}

        {error ? <div className="error-banner transcript-error">{error}</div> : null}
        {!loading && items.length === 0 ? (
          <div className="empty-note">{tt("noTranscript")}</div>
        ) : null}

        <div className="messages-container">
          {messageGroups.map((group) => {
            if (group.type === "thinking") {
              return (
                <ThinkingChain
                  expanded={expandedGroups.has(group.id)}
                  group={group}
                  key={group.id}
                  onPreviewAttachment={setPreviewedAttachment}
                  onToggle={() => toggleGroup(group.id)}
                  uiLanguage={props.uiLanguage}
                />
              );
            }

            return group.messages.map((item) => (
              <article className="message-turn" data-role={item.role} key={item.id}>
                <div className="turn-header">
                  <div className="turn-header-left">
                    <span className={`message-role ${transcriptTone(item.role)}`}>
                      {transcriptRoleLabel(item.role, props.uiLanguage)}
                    </span>
                  </div>
                </div>
                <MarkdownMessage
                  attachments={item.attachments}
                  content={item.content}
                  onPreviewAttachment={setPreviewedAttachment}
                  uiLanguage={props.uiLanguage}
                />
              </article>
            ));
          })}
        </div>
      </div>

      <form className="chat-composer" onSubmit={(event) => void submitMessage(event)}>
        <label className="sr-only" htmlFor={`message-input-${props.detail.threadId}`}>
          {tt("messageInputLabel")}
        </label>
        <textarea
          className="chat-composer-input"
          disabled={sending}
          id={`message-input-${props.detail.threadId}`}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={tt("messageInputPlaceholder")}
          rows={3}
          value={draft}
        />
        <button
          className="btn-sm primary chat-send-button"
          disabled={!draft.trim() || sending}
          type="submit"
        >
          {sending ? tt("sendingMessage") : tt("sendMessage")}
        </button>
      </form>

      {previewedAttachment ? (
        <ImageLightbox
          attachment={previewedAttachment}
          onClose={() => setPreviewedAttachment(null)}
          uiLanguage={props.uiLanguage}
        />
      ) : null}
    </section>
  );
}
