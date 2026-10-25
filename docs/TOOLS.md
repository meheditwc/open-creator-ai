# Tool reference

The catalogue in [`packages/shared/src/tools.ts`](../packages/shared/src/tools.ts) is the
single source of truth. The UI, the API and this page are all generated from it.

Status legend:

| Status    | Meaning                                                       |
| --------- | ------------------------------------------------------------- |
| `stable`  | The pipeline is defined, documented and wired into the studio |
| `beta`    | The pipeline works, but the defaults may still change         |
| `planned` | Specified, not yet implemented                                |

---

## Video Translation

Translate a source video: transcribe, translate the subtitles, dub the voice track and export.

- **Status** — stable
- **Inputs** — video file or URL · source language (auto-detect) · target language
- **Pipeline** — `download → transcribe → translate → dub → render`
- **Outputs** — translated video · SRT subtitles · dubbed audio track
- **Requires** — `ffmpeg`, `yt-dlp`, `whisper`

## Video Downloader

Pull source material from YouTube, Bilibili, TikTok, Instagram, Douyin and 100+ platforms.

- **Status** — stable
- **Inputs** — video URL
- **Pipeline** — `resolve → download`
- **Outputs** — source video file · metadata JSON
- **Requires** — `yt-dlp`

## Thumbnail Generator

Produce several click-worthy thumbnail variations from a title, a frame or a reference image.

- **Status** — stable
- **Inputs** — title · optional reference image · target aspect ratio
- **Pipeline** — `prompt → generate → rank`
- **Outputs** — 3–6 thumbnail PNGs · prompt log
- **Requires** — an image model

## Image Generation

Create illustrations, covers and b-roll stills from a prompt, with optional reference control.

- **Status** — stable
- **Inputs** — prompt · optional reference image · aspect ratio
- **Pipeline** — `prompt → generate`
- **Outputs** — generated image · prompt log
- **Requires** — an image model

## Video Generation

Generate short clips from text or a still image, then trim and caption them.

- **Status** — beta
- **Inputs** — prompt or image · duration · aspect ratio
- **Pipeline** — `prompt → generate → caption`
- **Outputs** — video clip · optional subtitle file
- **Requires** — a video model

## Article Writer

Turn a topic, a link or a video into a structured, editable long-form article.

- **Status** — stable
- **Inputs** — topic, links or video · audience · target length
- **Pipeline** — `research → outline → draft → export`
- **Outputs** — Markdown · HTML · PDF
- **Requires** — a text model

## Short Video Script

Write a shoot-ready, segmented script with hooks, beats and shot directions.

- **Status** — stable
- **Inputs** — topic · platform · audience · duration
- **Pipeline** — `angle → segments → polish`
- **Outputs** — segmented script · shot list · caption ideas
- **Requires** — a text model

## Stick Figure Animation

Turn a script or a YouTube link into narration, voiceover, storyboard, subtitles and video.

- **Status** — beta
- **Inputs** — script or URL · voice style · aspect ratio
- **Pipeline** — `script → narration → storyboard → render`
- **Outputs** — narration audio · subtitles · animated video
- **Requires** — `ffmpeg`, a TTS engine

## Voiceover & Dubbing

Generate expressive voice-overs and dub existing videos in another language.

- **Status** — stable
- **Inputs** — text or subtitles · voice · emotion · speed
- **Pipeline** — `chunk → synthesize → align`
- **Outputs** — audio track · aligned subtitles
- **Requires** — a TTS engine

## Subtitle Studio

Transcribe, translate, burn in or re-time subtitles with bilingual and short-form presets.

- **Status** — stable
- **Inputs** — media file or URL · languages · style preset
- **Pipeline** — `transcribe → translate → style → render`
- **Outputs** — SRT / VTT · burned-in video · bilingual track
- **Requires** — `ffmpeg`, `whisper`

## Workflow Planner

Describe an outcome and get a sequenced, tool-aware plan you can execute step by step.

- **Status** — beta
- **Inputs** — goal · constraints · deadline
- **Pipeline** — `decompose → map-tools → schedule`
- **Outputs** — step-by-step plan · tool checklist
- **Requires** — nothing

---

## Adding a tool

1. Add an entry to `TOOLS` in `packages/shared/src/tools.ts`:

   ```ts
   {
     id: 'my-tool',
     name: 'My Tool',
     category: 'video',          // video | image | audio | text | utility
     status: 'beta',             // stable | beta | planned
     summary: 'One sentence that shows up on the card.',
     icon: 'film',               // any name from the shared icon list
     accent: '#7c5cff',          // card accent colour
     inputs: ['What the creator provides'],
     outputs: ['What the creator gets back'],
     pipeline: ['step-one', 'step-two'],
     requires: ['ffmpeg'],
   }
   ```

2. Add the icon to the `Icon` component in `apps/web/src/components/Icon.tsx` if it is new.
3. Add keyword hints for the offline planner in `packages/shared/src/planner.ts`.
4. Run `npm run typecheck && npm run build` — the catalogue, the API and the docs follow.

No UI code, no API code, no documentation code: the catalogue _is_ the wiring.
