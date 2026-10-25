---
name: short-script
description: Write a shoot-ready, segmented short-form script with hooks, beats and shot directions.
---

# Short Video Script

A script is not an essay — it is a sequence of beats that fit a duration.

## When to use

- The user wants a script for a short (Reels, Shorts, TikTok).
- The user has a video idea and needs it structured for filming.
- The user wants caption ideas and a shot list to accompany the video.

## Inputs to collect

| Input    | Notes                                             |
| -------- | ------------------------------------------------- |
| Topic    | The one thing the video is about                  |
| Platform | TikTok / Reels / Shorts — each has its own pacing |
| Duration | 15 s, 30 s, 60 s                                  |
| Audience | Who is watching, and what do they already know    |
| Format   | talking head, screen recording, b-roll, unboxing  |

## The beat sheet (30 s reference)

| Beat        | Time      | Job                                               |
| ----------- | --------- | ------------------------------------------------- |
| **Hook**    | 0:00–0:03 | Stop the scroll — a claim, a question, a surprise |
| **Context** | 0:03–0:08 | Why this matters to _this_ viewer                 |
| **Payoff**  | 0:08–0:22 | The content — three beats maximum                 |
| **Proof**   | 0:22–0:26 | A result, a number, a demo                        |
| **CTA**     | 0:26–0:30 | One action, not three                             |

## Steps

1. **Write the hook first.** Ten options, then keep the sharpest one.
   - Test each hook against: does it create a gap the viewer wants closed?
2. **Write the payoff in three beats** — one idea per beat, one sentence each.
3. **Add the proof** — a number, a screenshot, a before/after.
4. **Add the CTA** — one sentence, one action.
5. **Direct the shoot** — for each beat write the shot, the framing and the on-screen text.
6. **Check the timing** — read it aloud at 2.5 words per second. Cut anything over.

## Output format

```markdown
## Hook (0:00–0:03)

"On screen: X" — "Spoken: Y" — "Cut to: Z"

## Beat 1 (0:03–0:08)

...
```

Also deliver: 5 caption ideas, 3 pinned-comment ideas, and a shot list.

## Failure modes

| Problem                | Response                                  |
| ---------------------- | ----------------------------------------- |
| The hook needs context | Rewrite it — the hook must stand alone    |
| It runs long           | Cut the second beat, not the payoff       |
| It sounds like an ad   | Drop the superlatives, keep the specifics |

## Studio integration

Available as the `short-script` tool — pipeline `angle → segments → polish`.
