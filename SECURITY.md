# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.2.x   | ✅        |
| < 0.2   | ❌        |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report it privately through GitHub's
[security advisory form](https://github.com/meheditwc/open-creator-ai/security/advisories/new)
or by contacting the maintainer directly.

Include:

- a description of the issue and its impact
- steps to reproduce
- the version or commit you tested
- any proof-of-concept material

You will get an acknowledgement within **72 hours**, an assessment within **7 days**,
and a fix or mitigation plan for confirmed issues. Please give us a reasonable
window to publish a fix before disclosing publicly.

## Security model

Open Creator AI is a **local-first** application. Understanding its boundaries helps
you use it safely.

| Area                   | Behaviour                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Network exposure**   | The daemon binds `127.0.0.1` by default. Only change `OPENCREATOR_HOST` if you understand the exposure — there is no authentication layer.                                                        |
| **CORS**               | `OPENCREATOR_CORS` defaults to `*` for convenience. Restrict it to your app's origin when the daemon is reachable beyond localhost.                                                               |
| **API keys**           | Provider keys are stored in `settings.json` inside your data directory, in plain text, and sent only to the provider you configure. They are never bundled into the client or sent anywhere else. |
| **Local storage**      | The offline fallback keeps projects and settings in browser `localStorage` — readable by any script running on that origin. Do not use it on a shared machine with sensitive content.             |
| **Command execution**  | The studio never executes shell commands. Media binaries (`ffmpeg`, `yt-dlp`, `whisper`) are invoked by _skills_, under your control, and are not shipped or auto-installed.                      |
| **Markdown rendering** | Agent output is rendered by a custom renderer that never uses `dangerouslySetInnerHTML` — output is safe by construction.                                                                         |

## Hardening for shared machines

1. Keep `OPENCREATOR_HOST=127.0.0.1`.
2. Set `OPENCREATOR_CORS` to your exact origin.
3. Keep the data directory readable only by your user (`chmod 700 .runtime`).
4. Rotate provider keys if the machine is shared.

## Out of scope

- Vulnerabilities in third-party tools you install yourself (`ffmpeg`, `yt-dlp`, …) —
  report those upstream.
- Issues in the model provider you configure.
- Running the daemon exposed to the public internet without a reverse proxy and
  authentication — that is a deployment decision, not a vulnerability in this project.
