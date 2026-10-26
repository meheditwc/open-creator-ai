# Screenshots

Every image in `docs/images/` is a screenshot of the running app — no mockups, no
composites. They are captured at **1440×900 with a 2× device pixel ratio** (the phone shot
at **430×932**) so they stay sharp on a Retina display.

| File                   | Route                  | What it shows                                              |
| ---------------------- | ---------------------- | ---------------------------------------------------------- |
| `dashboard.png`        | `#/dashboard`          | Journey, stats and recent runs, with a demo channel loaded |
| `tools.png`            | `#/tools`              | All twelve tools grouped by stage                          |
| `tool-drawer.png`      | `#/dashboard` → a tool | The answers a tool needs and the files it will write       |
| `run-details.png`      | `#/dashboard` → a run  | A finished run with its rendered `script.md` and friends   |
| `projects.png`         | `#/projects`           | One project per channel, all runs underneath               |
| `agent.png`            | `#/agent`              | The agent explaining which tool fits and how it runs       |
| `settings.png`         | `#/settings`           | Optional model provider, appearance, runtime               |
| `light-dashboard.png`  | `#/dashboard` (light)  | The same dashboard in the light theme                      |
| `mobile-dashboard.png` | `#/dashboard` (430px)  | The phone layout                                           |

## Re-capturing them

1. Start the app (`npm run dev`) and load some real content: create a project and run a few
   tools, or call the API directly (`POST /api/runs`) so the shots show finished runs
   instead of an empty workspace.
2. Open each route in a browser, keep the window at 1440×900, set the device pixel ratio to
   2, and capture the full viewport (not the whole scroll height) — the README shows them
   side by side, so consistent sizes matter more than completeness.
3. Save over the existing file in `docs/images/` with the same name; the README and
   `docs/GETTING_STARTED.md` pick the new image up automatically.

If you change any user-facing copy, re-capture the screenshot that shows it in the same
pull request — a screenshot that contradicts the UI is worse than none.
