# Getting started

## Prerequisites

| Requirement | Version  | Why                                                                |
| ----------- | -------- | ------------------------------------------------------------------ |
| Node.js     | ≥ 22.18  | Native TypeScript execution — the daemon runs `.ts` files directly |
| npm         | ≥ 10     | Workspaces (pnpm works too — see below)                            |
| Docker      | optional | Only if you want a free local LLM router (FreeLLMAPI)              |
| ffmpeg      | no       | Not needed — the studio generates documents, not media             |

Check your Node version:

```bash
node -v   # v22.18.0 or newer
```

## Install

```bash
git clone https://github.com/meheditwc/open-creator-ai.git
cd open-creator-ai
npm install
```

There is nothing to compile — the daemon has no native dependencies and the studio
builds with Vite.

### Prefer pnpm?

The repository is also a valid pnpm workspace:

```bash
corepack enable
pnpm install
pnpm dev
```

## Run

```bash
npm run dev
```

| Service | URL                      | Notes                  |
| ------- | ------------------------ | ---------------------- |
| Studio  | <http://localhost:19861> | Open this one          |
| Daemon  | <http://127.0.0.1:9861>  | API used by the studio |

Run them separately if you prefer:

```bash
npm run dev:daemon   # runtime only
npm run dev:web      # studio only
```

## First five minutes

1. **Open the studio** at <http://localhost:19861>. You land on the dashboard; the
   sidebar shows _Daemon online_.
2. **Create a project** — _Projects → New project_. Call it `Launch teaser`.
3. **Pick a tool** — _Creator tools → Video Translation_. The drawer shows the
   pipeline, the inputs and the outputs.
4. **Start a run** — pick the project, give it a name, press _Start run_. The run
   appears in the dashboard timeline and advances through its stages.
5. **Ask the agent** — open _Agent_ and type _"I need to translate a 4 minute
   YouTube video into Spanish with a dubbed voice track"_. Without a provider you
   still get a real, actionable plan.

## Connect a model provider

The studio is fully usable offline. To unlock the LLM-backed agent, open
_Settings → Model provider_ and enter:

| Field    | Value                                 |
| -------- | ------------------------------------- |
| Base URL | `http://localhost:3001/v1`            |
| API key  | the unified key printed by FreeLLMAPI |
| Model    | e.g. `gpt-4o-mini`                    |

A free local router, if you want one:

```bash
docker run -d -p 3001:3001 ghcr.io/tashfeenahmed/freellmapi:latest
```

Other providers that work out of the box:

| Provider  | Base URL                    |
| --------- | --------------------------- |
| Ollama    | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1`  |
| LiteLLM   | `http://localhost:4000/v1`  |
| OpenAI    | `https://api.openai.com/v1` |

## Build for production

```bash
npm run build     # bundles the studio into apps/web/dist
npm start         # the daemon serves the built studio on http://127.0.0.1:9861
```

## Where is my data?

| What           | Where                                               |
| -------------- | --------------------------------------------------- |
| Projects, runs | `<OPENCREATOR_DATA_DIR>/projects.json`, `runs.json` |
| Settings       | `<OPENCREATOR_DATA_DIR>/settings.json`              |
| Offline backup | browser `localStorage` under `open-creator-ai.*`    |

The default data directory is `.runtime/` in the repository root (git-ignored).
Change it with `OPENCREATOR_DATA_DIR=/somewhere/else`.

## Troubleshooting

| Symptom                      | Fix                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| _Daemon offline_ banner      | Start the runtime: `npm run dev:daemon`                                            |
| Agent says _offline planner_ | No provider configured — set one in Settings                                       |
| Port 19861 already in use    | `PORT=3000 npm run dev:web` (the daemon proxy target stays 9861)                   |
| Port 9861 already in use     | `PORT=9862 npm run dev:daemon` and set `OPENCREATOR_DAEMON_URL`                    |
| A run produced no files      | Check the run's error banner; every tool writes into `.runtime/artifacts/<runId>/` |
| Stale data after a crash     | Delete `.runtime/*.json` — the daemon recreates them on boot                       |

Still stuck? Open an issue — include the output of `npm run dev:daemon` and your
Node version.
