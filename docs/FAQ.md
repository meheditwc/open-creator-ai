# FAQ

## General

### Is this free?

Yes. Apache-2.0 licensed, no accounts, no telemetry, no paid tier. If you want a free
LLM to drive the agent, run [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi)
locally — one `docker run` and you are done.

### Do I need an API key to use it?

No. All twelve channel tools are deterministic generators — niche report, scripts, SEO
pack, captions, calendar, roadmap — and they run with no key, no account and no
binaries. A provider key only upgrades the **agent chat**; it never unlocks a tool.

### Which models can I use?

Anything that speaks the OpenAI chat-completions API: FreeLLMAPI, Ollama, LM Studio,
LiteLLM, vLLM, OpenAI, OpenRouter, Groq, Together, or your own gateway. Point the
**Base URL** at it and enter the key.

### What does the studio actually produce?

Real files. Every run writes its documents into `.runtime/artifacts/<runId>/` — Markdown,
CSV, JSON, SRT, VTT and HTML — and the studio serves them back for preview, copy and
download. There are no simulated runs and no placeholder content; the test suite fails
if a tool does not write every file it advertises.

### Does it generate images or video?

No, deliberately. The studio covers the part that decides whether a channel works —
the niche, the words, the packaging and the schedule — and leaves filming and editing to
you. That is why it needs no `ffmpeg`, no models and no keys.

### Can I use it without the daemon?

Yes — the studio degrades to `localStorage` and shows an _Offline mode_ banner.
The agent still answers from the shared planner.

## Setup

### Which Node version?

22.18 or newer. The daemon runs TypeScript directly using Node's built-in type
stripping, so there is no build step and no `tsx` dependency.

### `npm ci` fails with a lockfile error

The lockfile is committed — use `npm ci` for a reproducible install, or `npm install`
if you are adding a dependency.

### Port 19861 is already in use

```bash
PORT=3000 npm run dev:web
```

The daemon stays on 9861; the Vite dev server proxies `/api` to it.

### The daemon says "offline" in the sidebar

The studio cannot reach `http://127.0.0.1:9861`. Start the runtime with
`npm run dev:daemon`, or check that `OPENCREATOR_HOST`/`PORT` match.

### Where does my data live?

In `OPENCREATOR_DATA_DIR` (default `.runtime/` in the repo root):
`projects.json`, `runs.json`, `settings.json`. Writes are atomic, so a crash cannot
corrupt them. Delete the files to reset the workspace.

## Using it

### Can I drive the studio from a script?

Yes — `packages/shared` ships a typed client:

```ts
import { CreatorClient } from '@open-creator/shared';

const client = new CreatorClient({ baseUrl: 'http://127.0.0.1:9861' });
const { items } = await client.listProjects();
```

### How do I add a tool?

Add an entry to `TOOLS` in `packages/shared/src/tools.ts` (fields + deliverables), add a
generator to `apps/daemon/src/youtube.ts`, and a case to `GENERATORS` in
`apps/daemon/src/worker.ts`. The UI, the API validation, the planner and the docs all
follow automatically — see [`docs/TOOLS.md`](TOOLS.md).

### How do I write a skill?

See [`docs/SKILLS.md`](SKILLS.md). A skill is a Markdown file with frontmatter in
`skills/<name>/SKILL.md`.

### Why is there no Tailwind?

Because the design system is ~700 lines of hand-written CSS with custom properties
for both themes. No PostCSS, no class-name convention, no migration story, and the
bundle stays small.

### Why JSON files and not SQLite?

Native database drivers mean a compiler on every install. For the data we actually
store, atomic JSON documents are enough — and the storage layer is behind a single
class, so swapping in a database later is a contained change.

## Contributing

### How do I run the checks?

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

All four also run in CI on every push and pull request.

### What commit style do you use?

[Conventional commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`,
`docs:`, `refactor:`, `test:`, `chore:`.

### Can I work on a large feature?

Open an issue first so we can agree on the approach before you spend a weekend on it.

## Security

### Is my API key safe?

It is stored in plain text in `settings.json` inside your data directory and sent only
to the provider you configured. It is never bundled into the browser client. Treat the
data directory like any other credential store and keep it readable only by your user.

### Can I expose the daemon on my network?

Not without care. It has no authentication layer. Keep `OPENCREATOR_HOST=127.0.0.1`,
or put it behind a reverse proxy with auth and set `OPENCREATOR_CORS` to your origin.
Read [`SECURITY.md`](../SECURITY.md) for the full model.
