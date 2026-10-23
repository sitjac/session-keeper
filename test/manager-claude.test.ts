import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CodexKeeper } from "@codex-keeper/core";
import { describe, expect, it } from "vitest";

import { createTempWorkspace, writeClaudeSessionFixture } from "./helpers.js";

describe("claude session management", () => {
  it("scans, lists, renames, and deletes Claude sessions alongside Codex", async () => {
    const workspace = await createTempWorkspace();
    const claudeHome = await fs.mkdtemp(path.join(os.tmpdir(), "csm-claude-home-"));

    await writeClaudeSessionFixture({
      claudeHome,
      cwd: "/home/ecarx/Work/demo",
      sessionId: "claude-sess-1",
      userMessage: "帮我看看这个项目",
      assistantMessage: "好的，这就看",
      aiTitle: "看看项目",
    });

    const manager = await CodexKeeper.create({
      cwd: workspace.root,
      overrides: {
        general: {
          codexHome: workspace.codexHome,
          claudeHome,
          stateDir: workspace.stateDir,
        },
      },
      operator: "test",
    });

    const sessions = await manager.listSessions();
    const claudeSession = sessions.find((s) => s.threadId === "claude-sess-1");
    expect(claudeSession).toBeDefined();
    expect(claudeSession?.source).toBe("claude");
    expect(claudeSession?.officialName).toBe("看看项目");
    expect(claudeSession?.workspaceLabel).toBe("demo");

    const detail = await manager.getSessionDetail("claude-sess-1", {
      includeTranscript: true,
    });
    expect(detail?.source).toBe("claude");
    expect(detail?.transcript?.items.some((i) => i.role === "user")).toBe(true);

    const rename = await manager.rename("claude-sess-1", "重命名后的会话");
    expect(rename.written).toBe(true);

    const renamed = await manager.getSessionDetail("claude-sess-1");
    expect(renamed?.officialName).toBe("重命名后的会话");

    const claudeFile = path.join(
      claudeHome,
      "projects",
      "-home-ecarx-Work-demo",
      "claude-sess-1.jsonl",
    );
    const raw = await fs.readFile(claudeFile, "utf8");
    expect(raw).toContain('"aiTitle":"重命名后的会话"');

    const history = await fs.readFile(path.join(claudeHome, "history.jsonl"), "utf8");
    expect(history).toContain('"display":"重命名后的会话"');

    const del = await manager.deleteSession("claude-sess-1");
    expect(del.deleted).toBe(true);

    await manager.close();
  });

  it("filters sessions by source", async () => {
    const workspace = await createTempWorkspace();
    const claudeHome = await fs.mkdtemp(path.join(os.tmpdir(), "csm-claude-home-"));

    await writeClaudeSessionFixture({
      claudeHome,
      cwd: "/home/ecarx/Work/demo",
      sessionId: "claude-sess-2",
      userMessage: "hi",
      assistantMessage: "hello",
    });

    const manager = await CodexKeeper.create({
      cwd: workspace.root,
      overrides: {
        general: {
          codexHome: workspace.codexHome,
          claudeHome,
          stateDir: workspace.stateDir,
        },
      },
      operator: "test",
    });

    const claudeOnly = await manager.listSessions({ source: "claude" });
    expect(claudeOnly.every((s) => s.source === "claude")).toBe(true);
    expect(claudeOnly.some((s) => s.threadId === "claude-sess-2")).toBe(true);

    await manager.close();
  });
});
