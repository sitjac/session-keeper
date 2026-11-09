import type {
  SessionSearchMatch,
  SessionSearchMatchRange,
  SessionTranscript,
  SessionTranscriptEntry,
} from "@session-keeper/shared";

const SNIPPET_MAX_LENGTH = 160;
const SNIPPET_CONTEXT = 60;
const ELLIPSIS = "…";

function isSearchableEntry(entry: SessionTranscriptEntry): boolean {
  if (entry.hidden) {
    return false;
  }
  return entry.role === "user" || entry.role === "assistant";
}

function collectRanges(haystack: string, needle: string): SessionSearchMatchRange[] {
  if (!needle) {
    return [];
  }
  const ranges: SessionSearchMatchRange[] = [];
  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let cursor = 0;
  while (cursor <= lowerHaystack.length - lowerNeedle.length) {
    const index = lowerHaystack.indexOf(lowerNeedle, cursor);
    if (index === -1) {
      break;
    }
    ranges.push({ start: index, end: index + lowerNeedle.length });
    cursor = index + lowerNeedle.length;
  }
  return ranges;
}

function buildSnippet(
  content: string,
  firstMatchStart: number,
  firstMatchEnd: number,
): { snippet: string; offset: number; prefix: boolean; suffix: boolean } {
  if (content.length <= SNIPPET_MAX_LENGTH) {
    return { snippet: content, offset: 0, prefix: false, suffix: false };
  }

  const matchCenter = Math.floor((firstMatchStart + firstMatchEnd) / 2);
  let start = Math.max(0, matchCenter - SNIPPET_CONTEXT);
  const end = Math.min(content.length, start + SNIPPET_MAX_LENGTH);
  if (end - start < SNIPPET_MAX_LENGTH) {
    start = Math.max(0, end - SNIPPET_MAX_LENGTH);
  }

  return {
    snippet: content.slice(start, end),
    offset: start,
    prefix: start > 0,
    suffix: end < content.length,
  };
}

export function searchSessionTranscript(
  transcript: SessionTranscript,
  query: string,
): SessionSearchMatch | undefined {
  const trimmed = query.trim();
  if (!trimmed) {
    return undefined;
  }

  for (let index = transcript.items.length - 1; index >= 0; index -= 1) {
    const entry = transcript.items[index];
    if (!entry || !isSearchableEntry(entry)) {
      continue;
    }
    const content = entry.content ?? "";
    if (!content) {
      continue;
    }
    const allRanges = collectRanges(content, trimmed);
    if (allRanges.length === 0) {
      continue;
    }
    const firstRange = allRanges[0]!;
    const { snippet, offset, prefix, suffix } = buildSnippet(
      content,
      firstRange.start,
      firstRange.end,
    );
    const snippetEnd = offset + snippet.length;
    const ranges = allRanges
      .filter((range) => range.start >= offset && range.end <= snippetEnd)
      .map((range) => ({
        start: range.start - offset + (prefix ? ELLIPSIS.length : 0),
        end: range.end - offset + (prefix ? ELLIPSIS.length : 0),
      }));
    if (ranges.length === 0) {
      continue;
    }
    const finalSnippet = `${prefix ? ELLIPSIS : ""}${snippet}${suffix ? ELLIPSIS : ""}`;
    return {
      entryId: entry.id,
      role: entry.role,
      timestamp: entry.timestamp,
      snippet: finalSnippet,
      ranges,
    };
  }

  return undefined;
}
