import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  appendClaudeAiTitle,
  decodeClaudeProjectDir,
  discoverClaudeSessionFiles,
  ingestClaudeFile,
  parseClaudeTranscript,
  removeClaudeHistory,
  updateClaudeHistory,
} from "@codex-keeper/core";
import { describe, expect, it } from "vitest";

async function tempClaudeHome(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "csm-claude-"));
}

describe("decodeClaudeProjectDir", () => {
  it("decodes an encoded cwd back to an absolute path", () => {
    expect(decodeClaudeProjectDir("-home-ecarx-Work-sitjac-project")).toBe(
      "/home/ecarx/Work/sitjac/project",
    );
  });

  it("handles a directory-style trailing dash", () => {
    expect(decodeClaudeProjectDir("-home-ecarx-Work-")).toBe("/home/ecarx/Work");
  });
});

describe("discoverClaudeSessionFiles", () => {
  it("finds session jsonl files and decodes their cwd", async () => {
    const claudeHome = await tempClaudeHome();
    const projectDir = path.join(claudeHome, "projects", "-home-ecarx-Work-foo");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, "abc-123.jsonl"), "{}\n");

    const files = await discoverClaudeSessionFiles(claudeHome);
    expect(files).toHaveLength(1);
    expect(files[0].sessionId).toBe("abc-123");
    expect(files[0].cwd).toBe("/home/ecarx/Work/foo");
  });
});

describe("ingestClaudeFile", () => {
  it("extracts session metadata from a Claude jsonl", async () => {
    const claudeHome = await tempClaudeHome();
    const projectDir = path.join(claudeHome, "projects", "-tmp-proj");
    await fs.mkdir(projectDir, { recursive: true });
    const filePath = path.join(projectDir, "sess-1.jsonl");
    await fs.writeFile(
      filePath,
      [
        JSON.stringify({ type: "mode", mode: "normal", sessionId: "sess-1" }),
        JSON.stringify({
          type: "user",
          message: { role: "user", content: "你好，帮我看看" },
          timestamp: "2026-10-22T09:05:12.630Z",
          cwd: "/tmp/proj",
          sessionId: "sess-1",
        }),
        JSON.stringify({
          type: "ai-title",
          aiTitle: "看看项目",
          sessionId: "sess-1",
        }),
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "好的，我来看看" }],
          },
          requestedModel: "claude-model",
          timestamp: "2026-10-22T09:05:16.538Z",
          cwd: "/tmp/proj",
          sessionId: "sess-1",
        }),
      ].join("\n") + "\n",
    );

    const result = await ingestClaudeFile({ path: filePath });
    expect(result.session).toBeDefined();
    expect(result.session?.threadId).toBe("sess-1");
    expect(result.session?.source).toBe("claude");
    expect(result.session?.cwd).toBe("/tmp/proj");
    expect(result.session?.projectName).toBe("proj");
    expect(result.session?.threadName).toBe("看看项目");
    expect(result.session?.model).toBe("claude-model");
    expect(result.session?.firstUserMessage).toBe("你好，帮我看看");
    expect(result.session?.lastAgentMessage).toBe("好的，我来看看");
  });
});

describe("parseClaudeTranscript", () => {
  it("maps user and assistant events to transcript entries", () => {
    const raw =
      [
        JSON.stringify({
          type: "user",
          message: { role: "user", content: "第一问" },
          timestamp: "2026-10-22T09:05:12.630Z",
        }),
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "第一答" }],
          },
          timestamp: "2026-10-22T09:05:16.538Z",
        }),
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              { type: "tool_use", name: "Bash", id: "call_1", input: { command: "ls" } },
              { type: "text", text: "执行完了" },
            ],
          },
          timestamp: "2026-10-22T09:05:18.000Z",
        }),
        JSON.stringify({
          type: "user",
          message: {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "call_1", content: "README.md" }],
          },
          timestamp: "2026-10-22T09:05:19.000Z",
        }),
      ].join("\n") + "\n";

    const transcript = parseClaudeTranscript(raw);
    expect(transcript.items.some((i) => i.role === "user" && i.content === "第一问")).toBe(true);
    expect(transcript.items.some((i) => i.role === "assistant" && i.content === "第一答")).toBe(
      true,
    );
    expect(transcript.items.some((i) => i.kind === "tool_call" && i.name === "Bash")).toBe(true);
    expect(
      transcript.items.some((i) => i.kind === "tool_output" && i.content.includes("README.md")),
    ).toBe(true);
  });

  it("preserves newlines so markdown blocks render correctly", () => {
    const raw =
      [
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              {
                type: "text",
                text: "先看结论：\n\n- 第一点\n- 第二点\n\n```ts\nconst x = 1;\n```",
              },
            ],
          },
          timestamp: "2026-10-22T09:05:16.538Z",
        }),
      ].join("\n") + "\n";

    const transcript = parseClaudeTranscript(raw);
    const assistant = transcript.items.find((i) => i.role === "assistant");
    expect(assistant).toBeDefined();
    expect(assistant?.content).toContain("\n- 第一点");
    expect(assistant?.content).toContain("```ts\nconst x = 1;\n```");
    // 不能把换行压成空格，否则 markdown 代码块/列表会混成一团。
    expect(assistant?.content).not.toContain("- 第一点 - 第二点");
  });
});

describe("claude writeback", () => {
  it("appends ai-title and updates history.jsonl on rename", async () => {
    const claudeHome = await tempClaudeHome();
    const projectDir = path.join(claudeHome, "projects", "-tmp-proj");
    await fs.mkdir(projectDir, { recursive: true });
    const filePath = path.join(projectDir, "sess-2.jsonl");
    await fs.writeFile(filePath, `{}\n`);

    const historyPath = path.join(claudeHome, "history.jsonl");
    await fs.writeFile(
      historyPath,
      `${JSON.stringify({ display: "旧名字", sessionId: "sess-2", project: "/tmp/proj" })}\n`,
    );

    await appendClaudeAiTitle({ filePath, sessionId: "sess-2", title: "新名字" });
    const raw = await fs.readFile(filePath, "utf8");
    expect(raw).toContain('"aiTitle":"新名字"');
    expect(raw).toContain('"sessionId":"sess-2"');

    const result = await updateClaudeHistory({
      historyPath,
      sessionId: "sess-2",
      title: "新名字",
    });
    expect(result.written).toBe(true);
    const history = await fs.readFile(historyPath, "utf8");
    expect(history).toContain('"display":"新名字"');
    expect(history).not.toContain("旧名字");
  });

  it("removes history entries on delete", async () => {
    const claudeHome = await tempClaudeHome();
    const historyPath = path.join(claudeHome, "history.jsonl");
    await fs.writeFile(
      historyPath,
      [
        JSON.stringify({ display: "a", sessionId: "keep", project: "/tmp" }),
        JSON.stringify({ display: "b", sessionId: "drop", project: "/tmp" }),
      ].join("\n") + "\n",
    );

    const result = await removeClaudeHistory({ historyPath, sessionId: "drop" });
    expect(result.removed).toBe(1);
    const history = await fs.readFile(historyPath, "utf8");
    expect(history).toContain('"sessionId":"keep"');
    expect(history).not.toContain('"sessionId":"drop"');
  });
});
