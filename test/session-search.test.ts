import type { SessionTranscript, SessionTranscriptEntry } from "@session-keeper/shared";
import { describe, expect, test } from "vitest";

import { searchSessionTranscript } from "../packages/core/src/session-search.js";

function makeEntry(partial: Partial<SessionTranscriptEntry>): SessionTranscriptEntry {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    role: partial.role ?? "user",
    kind: partial.kind ?? "message",
    content: partial.content ?? "",
    timestamp: partial.timestamp,
    hidden: partial.hidden,
    ...partial,
  };
}

function makeTranscript(entries: SessionTranscriptEntry[]): SessionTranscript {
  return {
    items: entries,
    counts: {
      total: entries.length,
      visible: entries.filter((entry) => !entry.hidden).length,
      hidden: entries.filter((entry) => entry.hidden).length,
      tools: entries.filter((entry) => entry.role === "tool").length,
    },
  };
}

describe("searchSessionTranscript", () => {
  test("returns undefined for empty query", () => {
    const transcript = makeTranscript([makeEntry({ content: "hello world" })]);
    expect(searchSessionTranscript(transcript, "")).toBeUndefined();
    expect(searchSessionTranscript(transcript, "   ")).toBeUndefined();
  });

  test("matches user message content case-insensitively", () => {
    const transcript = makeTranscript([
      makeEntry({ id: "e1", role: "user", content: "Please review the Code style." }),
    ]);
    const match = searchSessionTranscript(transcript, "code");
    expect(match).toBeDefined();
    expect(match?.entryId).toBe("e1");
    expect(match?.snippet).toContain("Code");
    expect(match?.ranges).toHaveLength(1);
    const range = match!.ranges[0]!;
    expect(match!.snippet.slice(range.start, range.end).toLowerCase()).toBe("code");
  });

  test("matches assistant message content", () => {
    const transcript = makeTranscript([
      makeEntry({ id: "a1", role: "assistant", content: "I will refactor the module." }),
    ]);
    const match = searchSessionTranscript(transcript, "refactor");
    expect(match?.entryId).toBe("a1");
    expect(match?.role).toBe("assistant");
  });

  test("skips tool, system, and hidden entries", () => {
    const transcript = makeTranscript([
      makeEntry({ id: "t1", role: "tool", content: "keyword in tool output" }),
      makeEntry({ id: "s1", role: "system", content: "keyword in system" }),
      makeEntry({ id: "h1", role: "user", content: "keyword hidden", hidden: true }),
    ]);
    expect(searchSessionTranscript(transcript, "keyword")).toBeUndefined();
  });

  test("returns the latest matching entry", () => {
    const transcript = makeTranscript([
      makeEntry({ id: "old", role: "user", content: "keyword first" }),
      makeEntry({ id: "new", role: "assistant", content: "keyword second" }),
    ]);
    const match = searchSessionTranscript(transcript, "keyword");
    expect(match?.entryId).toBe("new");
  });

  test("collects multiple ranges within the snippet", () => {
    const transcript = makeTranscript([
      makeEntry({ id: "e1", role: "user", content: "foo bar foo baz foo" }),
    ]);
    const match = searchSessionTranscript(transcript, "foo");
    expect(match?.ranges.length).toBe(3);
    for (const range of match!.ranges) {
      expect(match!.snippet.slice(range.start, range.end)).toBe("foo");
    }
  });

  test("truncates long content and adjusts range offsets", () => {
    const long = `${"x".repeat(200)} keyword ${"y".repeat(200)}`;
    const transcript = makeTranscript([makeEntry({ id: "e1", role: "user", content: long })]);
    const match = searchSessionTranscript(transcript, "keyword");
    expect(match).toBeDefined();
    expect(match!.snippet.length).toBeLessThanOrEqual(200);
    expect(match!.snippet.startsWith("…")).toBe(true);
    expect(match!.snippet.endsWith("…")).toBe(true);
    const range = match!.ranges[0]!;
    expect(match!.snippet.slice(range.start, range.end)).toBe("keyword");
  });

  test("returns undefined when no entry matches", () => {
    const transcript = makeTranscript([
      makeEntry({ id: "e1", role: "user", content: "hello world" }),
    ]);
    expect(searchSessionTranscript(transcript, "absent")).toBeUndefined();
  });
});
