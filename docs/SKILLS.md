# Skills

Skills are small instruction files that teach an agent how to run a creator workflow
end to end. They are plain Markdown with YAML frontmatter — no code, no runtime.

```markdown
---
name: video-translation
description: Transcribe, translate and dub a video end to end
---

# Video Translation

1. Resolve the source with `yt-dlp` …
```

## Using a skill

| Agent                | How                                                                           |
| -------------------- | ----------------------------------------------------------------------------- |
| **Codex CLI**        | `codex run --skill video-translation`                                         |
| **Any LLM agent**    | Paste the file, or point the agent at `skills/<name>/SKILL.md`                |
| **The studio agent** | Mention the goal in plain language — the planner maps it to the matching tool |

## Available skills

| Skill                 | Use it when                                                 |
| --------------------- | ----------------------------------------------------------- |
| `video-translation`   | A video needs to reach another language, dubbed             |
| `subtitle-studio`     | A video needs subtitles, translation or burn-in             |
| `voiceover-dubbing`   | A voice track has to be generated or replaced               |
| `thumbnail-generator` | A post needs cover art that gets clicked                    |
| `short-script`        | A short-form video needs a shoot-ready script               |
| `workflow-planner`    | A goal needs to be broken into a sequenced, executable plan |

## Writing a skill

1. Create `skills/<skill-name>/SKILL.md`.
2. Add frontmatter with a `name` (kebab-case) and a one-line `description` — that is
   what an agent matches against.
3. Write the steps as an ordered checklist. Prefer concrete commands
   (`yt-dlp -f best -o input.mp4 <url>`) over descriptions.
4. Say what to do when a step fails — a skill that only works on the happy path is
   half a skill.
5. Keep it under ~120 lines. Long skills get skipped by agents.

A good skill has this shape:

```markdown
---
name: my-skill
description: One line that says exactly when to use this
---

# My Skill

## When to use

- Situation A
- Situation B

## Steps

1. **Resolve** — command or tool call
2. **Process** — command or tool call
3. **Deliver** — where the output lands

## Failure modes

- Missing binary → say so and stop
- Rate limited → wait and retry once
```

## Using the studio API from a skill

The shared package ships a typed client, so a skill can drive the studio directly:

```ts
import { CreatorClient } from '@open-creator/shared';

const client = new CreatorClient({ baseUrl: 'http://127.0.0.1:9861' });
const { items } = await client.listProjects();
const run = await client.createRun({ tool: 'video-translation', title: 'Teaser' });
```

See [`packages/shared/src/client.ts`](../packages/shared/src/client.ts).
