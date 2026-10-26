# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Image generation is real image generation.** Every picture-producing tool now
  goes through a three-tier pipeline (`apps/daemon/src/imagegen.ts`):
  1. **your image model** — `/images/generations` on the configured base URL
     (`gpt-image-1`, `flux-1.1-pro`, `sdxl`, …), set in Settings → _Image model_;
  2. **a keyless image service** (Pollinations by default), so a fresh install
     produces actual AI art with no account and no key;
  3. **procedural art** — a seeded fractal/gradient/grain render by ffmpeg, used
     when neither of the above is reachable. Never a flat rectangle with text.
- Thumbnails are now **artwork + typographic layout** (lower / left / center),
  video clips use generated stills with a slow push-in as the backdrop, and
  `prompt-log.md` records which tier produced the art.
- `capabilities` reports `images: { provider, keyless, effective }`, and the run
  notes say which tier was used.
- Settings gained **Image model** and a **keyless image service** toggle.

### Fixed

- The worker's failure path could leave a run stuck in `running` when the error
  happened before the render context existed.
- Image-tier fallbacks are logged (`[image] provider unavailable: …`) instead of
  being swallowed.

### Added

- **Runs now render real files.** The daemon has a render worker that shells out to
  `ffmpeg` and writes deliverables into `<dataDir>/artifacts/<runId>/`:
  - Thumbnail Generator → 1–6 typographic PNG thumbnails in three layouts + a prompt log
  - Image Generation → 16:9 and 1:1 cover art + prompt log
  - Video Generation → MP4 with burned-in kinetic captions + SRT/VTT
  - Short Video Script → segmented script, vertical teaser MP4, SRT
  - Stick Figure Animation → stick-figure MP4 (ASS vector poses), storyboard PNGs, narration
  - Subtitle Studio → SRT + VTT + captioned preview MP4
  - Article Writer → Markdown + styled self-contained HTML
  - Workflow Planner → sequenced plan in Markdown
- **`GET /api/artifacts/:runId/:file`** serves rendered files with HTTP Range support, so
  video scrubbing and downloads work straight from the studio.
- **Run details drawer** in the studio: image/video/audio previews, file sizes,
  download buttons, the run input and any setup notes.
- **`GET /api/capabilities`** reports whether ffmpeg, yt-dlp and a provider are available,
  per tool, and the tool drawer shows a `ready` / `needs …` badge before you start a run.
- **`GET /api/runs/:id` and `DELETE /api/runs/:id`** (deleting a run removes its artifacts).
- **`npm run setup:media`** installs a local ffmpeg (system → `pip3 imageio-ffmpeg` →
  static GitHub build) into the git-ignored `apps/daemon/.bin/`.
- Tool drawer now takes real inputs: prompt/topic, source URL or text, aspect ratio,
  duration and variant count.

### Changed

- `Run` gained `artifacts`, `input`, `notes` and `error`; `ToolDefinition` gained `engine`
  (`local` / `provider` / `external`) so the catalogue states what each tool needs.
- The studio polls every 1.2s while a render is in flight (15s when idle).
- Tool statuses are now truthful: the tools that render locally are `stable`, the ones
  that need a provider or `yt-dlp` are `beta` and say what is missing.
- CI installs ffmpeg and the Docker image ships DejaVu fonts so rendered text matches.

### Fixed

- **Data loss on restart.** The daemon never read `projects.json` / `runs.json`
  back at startup, so every restart showed an empty workspace and the next
  write overwrote the stored projects and runs. The stores are now loaded
  before the first request is served.
- **Stuck runs.** A run that was mid-flight when the daemon stopped stayed
  `queued`/`running` forever; it is now marked `failed` with an honest message.
- **Silent overwrite of unreadable data.** A corrupt `projects.json`,
  `runs.json` or `settings.json` is moved aside as `*.corrupt-<timestamp>`
  instead of being replaced by an empty file.
- **Stale version.** `/api/health` reported `0.2.0` while the project was
  `0.3.0`; the daemon now reports the version from the package manifest.
- **Offline cache drift.** Creating a project updated the `localStorage`
  fallback but editing or deleting one did not, so the offline studio could
  resurrect deleted projects. Every mutation now updates the cache.
- **Unclear API errors.** Error responses now carry a stable `error` code
  (`BadRequest`, `NotFound`, …) instead of the class name `HttpError`, and the
  daemon explains an occupied port instead of crashing silently.

## [0.3.0] — 2026-10-25

### Changed

- Upgraded the studio to **React 19** (`react` / `react-dom` 19.3, `@types/react` 19).
  The `JSX` namespace is now imported from `react`, since React 19 no longer
  provides a global one.

## [0.2.0] — 2026-10-25

### Added

- **A real studio.** React 18 + Vite + TypeScript dashboard with a hand-written
  design system, dark and light themes, and a responsive layout.
- **A local runtime.** A dependency-free Node.js daemon (`node:http`, `node:fs`)
  serving projects, runs, settings, the tool catalogue and the agent endpoint.
- **Eleven creator tools** with typed inputs, outputs, pipelines and requirements,
  defined once in `packages/shared/src/tools.ts` and reused by the UI, the API and
  the docs.
- **An agent that always answers.** A shared offline planner detects intent, picks
  the matching tool and returns a real pipeline plan — with or without a provider.
- **Provider support** for any OpenAI-compatible endpoint (FreeLLMAPI, Ollama,
  LM Studio, LiteLLM, vLLM, hosted APIs), configured from the Settings screen.
- **Resilience everywhere.** If the daemon is down the studio keeps working from
  `localStorage`; if the provider is down the daemon answers with the planner.
- **`CreatorClient`** — a typed client for the HTTP API that works in Node and in the
  browser, for skills, scripts and CI jobs.
- **Six Codex-style skills** for video translation, subtitles, voiceovers,
  thumbnails, short scripts and workflow planning.
- **Documentation**: architecture, getting started, tool reference, skills guide,
  FAQ, security model and contribution guide.
- **CI** with typecheck, lint, tests and build, plus issue forms and a PR template.

### Changed

- Rebuilt the repository from the empty initial state; the previous single-line
  README is replaced by a complete project.

### Fixed

- The previous workspace referenced files that did not exist and styled pages with
  CSS utility classes that were never generated. Both are gone.

## [0.1.0] — 2024-10-17

### Added

- Initial commit: repository skeleton and README placeholder.

[0.3.0]: https://github.com/meheditwc/open-creator-ai/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/meheditwc/open-creator-ai/releases/tag/v0.2.0
[0.1.0]: https://github.com/meheditwc/open-creator-ai/releases/tag/v0.1.0
