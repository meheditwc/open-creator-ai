# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[0.2.0]: https://github.com/meheditwc/open-creator-ai/releases/tag/v0.2.0
[0.1.0]: https://github.com/meheditwc/open-creator-ai/releases/tag/v0.1.0
