import path from "node:path";

import { CLAUDE_PROJECTS_DIRNAME } from "@codex-keeper/shared";
import fg from "fast-glob";

export interface ClaudeSessionFile {
  /** Absolute path to the session jsonl file. */
  path: string;
  /** sessionId derived from the file name (without the .jsonl extension). */
  sessionId: string;
  /** Decoded working directory for the project this session belongs to. */
  cwd: string;
}

/**
 * Decode a Claude CLI "projects" directory name back into the absolute cwd it
 * represents. Claude encodes `/home/ecarx/Work/foo` as `-home-ecarx-Work-foo`:
 * the leading `-` replaces the root `/`, and each subsequent `/` becomes `-`.
 */
export function decodeClaudeProjectDir(dirname: string): string {
  // Strip a single trailing `-` that Claude appends to directory-style names.
  const normalized = dirname.endsWith("-") ? dirname.slice(0, -1) : dirname;
  // A leading `-` represents the root `/`; subsequent `-` are path separators.
  const parts = normalized.split("-");
  // The first element is empty when the encoded name starts with `-`.
  if (parts[0] === "") {
    parts.shift();
  }
  return `/${parts.join("/")}`;
}

/**
 * Discover every Claude CLI session file under `claudeHome/projects`.
 * Each `projects/<encoded-cwd>/<sessionId>.jsonl` maps to one session.
 */
export async function discoverClaudeSessionFiles(claudeHome: string): Promise<ClaudeSessionFile[]> {
  const projectsRoot = path.join(claudeHome, CLAUDE_PROJECTS_DIRNAME);
  const files = await fg("**/*.jsonl", {
    cwd: projectsRoot,
    absolute: true,
    onlyFiles: true,
  });

  return files
    .map((filePath) => {
      const relative = path.relative(projectsRoot, filePath);
      const dirname = path.dirname(relative);
      const sessionId = path.basename(relative, path.extname(relative));
      return {
        path: filePath,
        sessionId,
        cwd: decodeClaudeProjectDir(dirname),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}
