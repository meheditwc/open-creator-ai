# Tool reference

The catalogue in [`packages/shared/src/tools.ts`](../packages/shared/src/tools.ts) is the
single source of truth. The UI, the API and this page are all generated from it.

Status legend:

| Status    | Meaning                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `stable`  | Renders real files on your machine today (ffmpeg only, no provider needed) |
| `beta`    | Produces the parts it can, and tells you exactly what is still missing     |
| `planned` | Specified, not yet implemented                                             |

---

## What runs on your machine

- **local** (renders locally with ffmpeg — no API key needed): Thumbnail Generator, Image Generation, Video Generation, Article Writer, Short Video Script, Stick Figure Animation, Subtitle Studio, Workflow Planner
- **provider** (needs a text + TTS provider for the full output): Video Translation, Voiceover & Dubbing
- **external** (needs an external binary on this machine): Video Downloader

Every run writes its files to `<dataDir>/artifacts/<runId>/` and serves them at
`/api/artifacts/<runId>/<file>`. Open a run in the studio to preview or download them.

---

## Video Translation

Transcribe a source video, translate the subtitles, dub the voice track and export a new video.

- **Status** — `beta` · **category** — Video
- **Runs** — needs a text + TTS provider for the full output
- **Inputs** — Video file or URL · Source language (auto-detect) · Target language
- **Pipeline** — `download → transcribe → translate → dub → render`
- **Outputs** — Translated video · SRT subtitles · Dubbed audio track
- **Requires** — `ffmpeg`, `whisper`, `text + TTS provider`

## Video Downloader

Pull source material from YouTube, Bilibili, TikTok, Instagram, Douyin and 100+ other platforms.

- **Status** — `beta` · **category** — Video
- **Runs** — needs an external binary on this machine
- **Inputs** — Video URL
- **Pipeline** — `resolve → download`
- **Outputs** — Source video file · Metadata JSON
- **Requires** — `yt-dlp`

## Thumbnail Generator

Produce several click-worthy thumbnail variations from a title, a frame or a reference image.

- **Status** — `stable` · **category** — Image
- **Runs** — renders locally with ffmpeg — no API key needed
- **Inputs** — Title · Optional reference image · Target aspect ratio
- **Pipeline** — `prompt → generate → rank`
- **Outputs** — 3–6 thumbnail PNGs · Prompt log
- **Requires** — `ffmpeg`

## Image Generation

Create illustrations, covers and b-roll stills from a prompt, with optional reference control.

- **Status** — `stable` · **category** — Image
- **Runs** — renders locally with ffmpeg — no API key needed
- **Inputs** — Prompt · Optional reference image · Aspect ratio
- **Pipeline** — `prompt → generate`
- **Outputs** — Generated image · Prompt log
- **Requires** — `ffmpeg`

## Video Generation

Generate short clips from text or a still image, then trim and caption them.

- **Status** — `stable` · **category** — Video
- **Runs** — renders locally with ffmpeg — no API key needed
- **Inputs** — Prompt or image · Duration · Aspect ratio
- **Pipeline** — `prompt → generate → caption`
- **Outputs** — Video clip · Optional subtitle file
- **Requires** — `ffmpeg`

## Article Writer

Turn a topic, a link or a video into a structured, editable long-form article.

- **Status** — `stable` · **category** — Text
- **Runs** — renders locally with ffmpeg — no API key needed
- **Inputs** — Topic, links or video · Audience · Target length
- **Pipeline** — `research → outline → draft → export`
- **Outputs** — Markdown · HTML · PDF
- **Requires** — nothing outside the studio

## Short Video Script

Write a shoot-ready, segmented script with hooks, beats and shot directions for short form.

- **Status** — `stable` · **category** — Text
- **Runs** — renders locally with ffmpeg — no API key needed
- **Inputs** — Topic · Platform · Audience · Duration
- **Pipeline** — `angle → segments → polish`
- **Outputs** — Segmented script · Shot list · Caption ideas
- **Requires** — `ffmpeg`

## Stick Figure Animation

Turn a script or a YouTube link into narration, voiceover, storyboard, subtitles and video.

- **Status** — `stable` · **category** — Video
- **Runs** — renders locally with ffmpeg — no API key needed
- **Inputs** — Script or URL · Voice style · Aspect ratio
- **Pipeline** — `script → narration → storyboard → render`
- **Outputs** — Narration audio · Subtitles · Animated video
- **Requires** — `ffmpeg`

## Voiceover & Dubbing

Generate expressive voice-overs and dub existing videos in another language.

- **Status** — `beta` · **category** — Audio
- **Runs** — needs a text + TTS provider for the full output
- **Inputs** — Text or subtitles · Voice · Emotion · Speed
- **Pipeline** — `chunk → synthesize → align`
- **Outputs** — Audio track · Aligned subtitles
- **Requires** — `text + TTS provider`, `ffmpeg`

## Subtitle Studio

Transcribe, translate, burn in or re-time subtitles with bilingual and short-form presets.

- **Status** — `stable` · **category** — Utility
- **Runs** — renders locally with ffmpeg — no API key needed
- **Inputs** — Media file or URL · Languages · Style preset
- **Pipeline** — `transcribe → translate → style → render`
- **Outputs** — SRT / VTT · Burned-in video · Bilingual track
- **Requires** — `ffmpeg`

## Workflow Planner

Describe an outcome and get a sequenced, tool-aware plan you can execute step by step.

- **Status** — `stable` · **category** — Utility
- **Runs** — renders locally with ffmpeg — no API key needed
- **Inputs** — Goal · Constraints · Deadline
- **Pipeline** — `decompose → map-tools → schedule`
- **Outputs** — Step-by-step plan · Tool checklist
- **Requires** — nothing outside the studio
