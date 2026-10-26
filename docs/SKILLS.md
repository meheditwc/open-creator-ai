# Skills

Skills are small instruction files that teach an agent how to run a creator workflow
end to end. They are plain Markdown with YAML frontmatter — no code, no runtime.

```markdown
---
name: video-production
description: Produce one publish-ready video — script, captions, SEO, checklist
---

# Video Production

1. Run the Video Script tool with the topic and target length …
```

## Using a skill

| Agent                | How                                                                           |
| -------------------- | ----------------------------------------------------------------------------- |
| **Codex CLI**        | `codex run --skill video-production`                                          |
| **Any LLM agent**    | Paste the file, or point the agent at `skills/<name>/SKILL.md`                |
| **The studio agent** | Mention the goal in plain language — the planner maps it to the matching tool |

## Available skills

| Skill               | Use it when                                                |
| ------------------- | ---------------------------------------------------------- |
| `channel-launch`    | Someone is starting a channel and needs niche + identity   |
| `video-production`  | One video needs a script, captions, SEO pack and checklist |
| `growth-loop`       | The channel is publishing and needs milestones and systems |
| `article-repurpose` | A published video should become a search-friendly article  |

## Writing a skill

1. Create `skills/<skill-name>/SKILL.md`.
2. Add frontmatter with a `name` (kebab-case) and a one-line `description` — that is
   what an agent matches against.
3. Write the steps as an ordered checklist. Prefer concrete names — the studio
   tools (`video-script`, `youtube-seo`, …) and the files they write — over
   descriptions.
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
const run = await client.createRun({
  tool: 'video-script',
  prompt: 'how I batch a month of videos in two days',
  fields: { audience: 'solo creators', length: '8 minutes' },
});
// run.artifacts → script.md, shot-list.csv, captions.srt (served at run.artifacts[].url)
```

See [`packages/shared/src/client.ts`](../packages/shared/src/client.ts).
