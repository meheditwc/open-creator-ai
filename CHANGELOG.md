# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **The product is now a YouTube channel workflow, not a media generator.**
  Image generation, video generation, thumbnails-as-PNG, voiceover, dubbing,
  video download and subtitle downloads are removed, together with the whole
  ffmpeg / `yt-dlp` / keyless-image pipeline. Nothing in the studio needs a
  binary, a model or an API key any more.
- Twelve tools, ordered by the journey from an empty channel to a publishing
  habit: **Niche Finder**, **Channel Blueprint** (start) → **Keyword Research**,
  **Content Calendar** (plan) → **Video Script**, **Shorts Script** (write) →
  **YouTube SEO**, **Thumbnail Brief**, **Captions**, **Upload Checklist**
  (publish) → **Channel Roadmap**, **Article Writer** (grow).
- `apps/daemon/src/youtube.ts` replaces the render pipeline with pure, seeded
  generators, so the same answers always produce the same documents.
- Every tool declares the files it writes (`deliverables`) and the fields it
  needs (`fields`); the studio renders those fields as a form and the tool
  drawer lists the exact filenames before you start.
- The dashboard is a five-stage journey with the tools grouped by stage.
- Run artifacts are `text`, `subtitle`, `data` or `document` — Markdown, SRT,
  VTT, CSV, JSON and HTML — previewed, copyable and downloadable.
- `npm run setup:media` is gone; `package.json` and `.env.example` dropped every
  media-binary and image-model setting. Version bumped to `0.4.0`.

### Fixed

- `?download=1` now sends `content-disposition: attachment`, so the download
  button actually saves the file instead of opening it.
- `Content Calendar` read its "uploads per week" answer as a raw number and
  silently produced a one-row CSV when the field was a string.

### Tests

- The suite now proves the acceptance criterion: **every tool, run for real,
  writes every file it advertises**, with non-empty content that is not a
  placeholder, plus determinism, MIME types, download headers, restart recovery
  and the offline planner.

### Removed

- `apps/daemon/src/imagegen.ts`, `media.ts`, `renderers.ts`, `provider.ts`,
  `scripts/setup-media.mjs` and the bundled `.bin/ffmpeg`.

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
