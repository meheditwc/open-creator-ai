---
name: thumbnail-generator
description: Produce several ranked thumbnail variations from a title, a frame or a reference image.
---

# Thumbnail Generator

Thumbnails are a design problem, not a generation problem. Work the layout first,
generate second, rank third.

## When to use

- A video or post needs a cover image.
- An existing thumbnail is not getting clicks and needs variants.
- A series needs a consistent visual style.

## Steps

1. **Read the title and the context**
   - What is the video about, in one sentence?
   - Who is the audience and what emotion should the thumbnail create?

2. **Pick the layout**

   | Layout   | Best for                             |
   | -------- | ------------------------------------ |
   | `face`   | talking head, reaction, story videos |
   | `object` | tutorials, gear, "how to" content    |
   | `text`   | announcements, lists, big claims     |
   | `split`  | before/after, versus, comparison     |

3. **Write one prompt per variation**
   - Keep the subject identical across variations — only the composition changes.
   - Specify: subject, expression or action, framing, lighting, palette, aspect ratio.
   - Example:
     > `Close-up portrait of a surprised creator holding a phone, warm rim light,
purple and cyan background, high contrast, cinematic, 16:9`

4. **Generate 3–6 variations**, then **rank** them:

   | Signal                   | Weight  |
   | ------------------------ | ------- |
   | Legibility at 10 % scale | highest |
   | Title space              | high    |
   | Contrast                 | high    |
   | Face/emotion             | medium  |
   | Brand consistency        | medium  |

5. **Composite the title**
   - 3–5 words maximum, bold sans serif, high contrast.
   - Never cover the face or the subject.
   - Keep a clear safe area (about 5 % margin) for platform cropping.

6. **Deliver** — `thumb-01.png` … `thumb-NN.png` at the platform size
   (1280×720 for YouTube, 1080×1920 for Shorts), plus the prompt log.

## Failure modes

| Problem                               | Response                                     |
| ------------------------------------- | -------------------------------------------- |
| Text baked into the image looks wrong | Composite the text yourself after generation |
| Variations look identical             | Change the layout, not the adjectives        |
| Aspect ratio is wrong                 | Specify it in the prompt and re-generate     |

## Studio integration

Available as the `thumbnail-generator` tool — pipeline `prompt → generate → rank`.
