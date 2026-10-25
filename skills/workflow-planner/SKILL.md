---
name: workflow-planner
description: Turn a creator goal into a sequenced, tool-aware execution plan.
---

# Workflow Planner

Goal in, executable plan out. The plan must be runnable by someone who has never
used this studio before.

## When to use

- The user describes an outcome but not the steps ("I want to launch a course video").
- The user has several tools and wants to know which to use, in which order.
- A plan is needed before any media is generated.

## Steps

1. **Restate the outcome** in one sentence, in the creator's own terms.
   If you cannot, ask one clarifying question — not five.

2. **Name the deliverables**
   - List every artefact that must exist at the end (video, thumbnail, captions, post).
   - For each one: aspect ratio, duration, language, and where it gets published.

3. **Map deliverables to tools**
   Use the studio catalogue. Prefer the fewest tools that produce the deliverables.

4. **Order the steps**
   - Work upstream first: source material → transcript → translation → voice → render.
   - Each step consumes the output of the previous one. Name that output explicitly.

5. **Mark the dependencies**
   - 🔧 Needs a local binary (`ffmpeg`, `yt-dlp`, `whisper`, a TTS engine)
   - 🤖 Needs a model provider
   - 👤 Needs the creator (a decision, a voice, a review)

6. **Estimate** — rough wall-clock time per step, based on the length of the media.

7. **Deliver the plan**

```markdown
## Outcome

One sentence.

## Deliverables

- 1 × 16:9 launch video (EN + ES) — for YouTube
- 3 × 1:1 thumbnails — for the post

## Steps

1. **Download source** 🔧 yt-dlp — ~2 min
2. **Transcribe** 🔧 whisper — ~5 min
3. **Translate + dub** 🤖 provider + 🔧 ffmpeg — ~10 min
4. **Render** 🔧 ffmpeg — ~4 min
5. **Thumbnails** 🤖 image model — ~3 min
6. **Review** 👤 creator sign-off

## Blockers

- ffmpeg is not installed
```

## Failure modes

| Problem                     | Response                                                |
| --------------------------- | ------------------------------------------------------- |
| The goal is vague           | Ask one question about the deliverable                  |
| No tool fits                | Say so, and propose the nearest tool plus a manual step |
| Too many steps for the time | Offer a smaller cut that still ships something          |

## Studio integration

Available as the `workflow-planner` tool — pipeline `decompose → map-tools → schedule`.
It is also what the offline agent planner falls back to.
