# session-keeper

A local-first session manager for browsing, renaming, and deleting **Codex** and **Claude CLI** sessions, keeping the names shown in the Web UI in sync with what each CLI shows under `/resume`.

![Language: TypeScript](https://img.shields.io/static/v1?label=Language&message=TypeScript&color=3178c6&style=flat-square)
![Node 20+](https://img.shields.io/static/v1?label=Node&message=20%2B&color=43853d&style=flat-square)
![Local-first](https://img.shields.io/static/v1?label=Mode&message=Local-first&color=2563eb&style=flat-square)
![License: MIT](https://img.shields.io/static/v1?label=License&message=MIT&color=2563eb&style=flat-square)

## Features

- **Group sessions by workspace** — sessions are organized under collapsible workspaces instead of one flat list.
- **Manual rename** — click a session title in the detail header to edit it; the UI refreshes immediately.
- **Sync with Codex CLI** — renames are written back to Codex's session index and local state so `/resume` shows the same name.
- **Sync with Claude CLI** — renames append an `ai-title` event to the session jsonl and update the `display` field in `history.jsonl`.
- **Delete sessions** — removes the session and cleans up the local index/state on both the CLI and keeper sides.
- **Readable transcripts** — conversation content is organized by user input and assistant output.

## Getting Started

```bash
git clone https://github.com/sitJac/session-keeper.git
cd session-keeper
npm install
npm run serve
```

Then open <http://127.0.0.1:42110>. `npm run serve` builds the runtime and Web UI, then starts the local API server (bound to `127.0.0.1` by default).

## Usage

```bash
npm run serve                            # build + start the local server
npm run web                              # start the Web UI dev server
npm run api                              # start the API only
npm run cli -- list                      # list sessions
npm run cli -- list --source claude      # list Claude sessions only
npm run cli -- show --id <threadId>      # show a session
npm run cli -- rename --id <threadId> --name "New name"
```

## Development

```bash
npm run lint          # ESLint/Biome, zero warnings allowed
npm run build         # compile all TypeScript project references
npm run web:build     # build the Vite dashboard
npm test              # run the Vitest suite
npm run validate:full # CI-equivalent check before pushing
```

## Project Structure

```text
packages/core     session scanning, indexing, writeback, and state management
packages/shared   shared types and schemas across API, Web, and CLI
packages/api      local HTTP API
packages/cli      CLI entry point and serve launcher
packages/web      Web UI
test              Vitest regression tests
docs              design notes and detailed documentation
scripts           development helper scripts
```

## Documentation

See [`docs/`](docs/) for detailed writeback mechanics and the original Chinese README ([`docs/README.zh-CN.md`](docs/README.zh-CN.md)).

## License

MIT
