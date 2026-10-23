# Changelog

All notable changes to sitJac/session-keeper will be documented in this file.

## [Unreleased]

### Added

- Local-first Codex session scanner for `~/.codex/sessions/**/rollout-*.jsonl`.
- Workspace-grouped Web UI for browsing sessions and reading filtered transcripts.
- Manual session rename with writeback to `session_index.jsonl`, rollout `thread_name_updated` events, and Codex `state_*.sqlite`.
- Session delete support with rollout, index, and local state cleanup.
- CLI and local HTTP API for listing, showing, renaming, deleting, and compacting session index records.
- Regression tests for title source priority, Codex CLI sync, internal session filtering, API behavior, and transcript rendering.
- Claude CLI session support: scan, browse, rename, and delete sessions under `~/.claude/projects`, with `ai-title`/`history.jsonl` writeback.
- Add a `codex`/`claude` source badge in the UI.
- `--source` filter on the CLI `list` command.
- Pasted image attachments in transcripts and copy controls for markdown blocks.
- Interactive markdown transcripts, a light/dark/system theme toggle, and bulk workspace collapse controls.
- Autostart service files for `npm run serve`.
- Upgraded `@fastify/static`, `tsx`, and `vitest` to address security advisories.
