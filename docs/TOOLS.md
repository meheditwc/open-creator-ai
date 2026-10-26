# Tool reference

Twelve tools covering the whole channel workflow. Every one of them runs locally, deterministically and without a model, an API key or a binary — and writes the files listed under **Deliverables** into `.runtime/artifacts/<runId>/`.

Source of truth: [`packages/shared/src/tools.ts`](../packages/shared/src/tools.ts). Generators: [`apps/daemon/src/youtube.ts`](../apps/daemon/src/youtube.ts).

## At a glance

| Stage             | Tool                                             | Files                                         |
| ----------------- | ------------------------------------------------ | --------------------------------------------- |
| Start the channel | **Niche Finder** (`niche-finder`)                | `niche-report.md`, `niches.csv`               |
| Start the channel | **Channel Blueprint** (`channel-blueprint`)      | `channel-blueprint.md`, `channel-copy.json`   |
| Plan              | **Keyword Research** (`keyword-research`)        | `keywords.csv`, `keyword-plan.md`             |
| Plan              | **30-Day Content Calendar** (`content-calendar`) | `calendar-30-days.csv`, `calendar-plan.md`    |
| Write             | **Video Script** (`video-script`)                | `script.md`, `shot-list.csv`, `captions.srt`  |
| Write             | **Shorts Script** (`shorts-script`)              | `shorts-script.md`, `captions.srt`            |
| Publish           | **YouTube SEO Pack** (`youtube-seo`)             | `seo-pack.md`, `metadata.json`                |
| Publish           | **Thumbnail Brief** (`thumbnail-brief`)          | `thumbnail-brief.md`, `overlay-text.txt`      |
| Publish           | **Captions & Chapters** (`captions`)             | `captions.srt`, `captions.vtt`, `chapters.md` |
| Publish           | **Upload Checklist** (`upload-checklist`)        | `upload-checklist.md`, `checklist.json`       |
| Grow              | **Channel Roadmap** (`channel-roadmap`)          | `roadmap.md`                                  |
| Grow              | **Blog & Community Post** (`article-writer`)     | `article.md`, `article.html`                  |

---

## Niche Finder

`niche-finder` · Start the channel · Strategy

Pick a channel niche you can actually sustain: candidate niches, audience, competition, monetisation paths and the first videos to make.

**Fields**

- What are you good at, or what could you talk about for hours? *
- Audience
- Language / market (English / Bangla / Hindi / Urdu / Spanish / Arabic / Portuguese / Indonesian)

**Pipeline**

`interests` → `candidates` → `score` → `shortlist`

**Deliverables**

- `niche-report.md`
- `niches.csv`

## Channel Blueprint

`channel-blueprint` · Start the channel · Strategy

Everything the channel needs on day one: name ideas, handle, About section, trailer script, playlists and the settings checklist.

**Fields**

- Channel niche *
- Audience
- Name idea (optional)
- Language / market (English / Bangla / Hindi / Urdu / Spanish / Arabic / Portuguese / Indonesian)

**Pipeline**

`naming` → `positioning` → `copy` → `settings`

**Deliverables**

- `channel-blueprint.md`
- `channel-copy.json`

## Keyword Research

`keyword-research` · Plan · SEO

Turn one topic into keyword clusters: primary, long-tail, question, comparison and Shorts keywords, with intent and competition.

**Fields**

- Seed topic or keyword *
- Audience
- Language / market (English / Bangla / Hindi / Urdu / Spanish / Arabic / Portuguese / Indonesian)
- Keywords you already want (optional)

**Pipeline**

`seed` → `expand` → `classify` → `cluster`

**Deliverables**

- `keywords.csv`
- `keyword-plan.md`

## 30-Day Content Calendar

`content-calendar` · Plan · Strategy

A month of uploads mapped out: titles, series, keywords, shorts cut from each long video and the publish days.

**Fields**

- Niche *
- Uploads per week (1 / 2 / 3)
- Audience
- Language / market (English / Bangla / Hindi / Urdu / Spanish / Arabic / Portuguese / Indonesian)

**Pipeline**

`pillars` → `schedule` → `titles` → `shorts`

**Deliverables**

- `calendar-30-days.csv`
- `calendar-plan.md`

## Video Script

`video-script` · Write · Scripts

A retention-first long-form script: hook, roadmap, sections with talking points and b-roll, mid CTA, outro — plus a shot list and captions.

**Fields**

- Video title or topic *
- Audience
- Target length (3 minutes / 5 minutes / 8 minutes / 12 minutes / 18 minutes)
- Tone (Friendly teacher / Direct and no-fluff / Documentary / Funny / Motivational)
- Anything to include or avoid (optional)

**Pipeline**

`hook` → `structure` → `sections` → `shot-list` → `captions`

**Deliverables**

- `script.md`
- `shot-list.csv`
- `captions.srt`

## Shorts Script

`shorts-script` · Write · Scripts

A 20–60 second vertical script with hook, three beats, on-screen text and a CTA, timed line by line for the edit.

**Fields**

- Shorts topic *
- Duration (20 seconds / 30 seconds / 45 seconds / 60 seconds)
- Tone (Friendly teacher / Direct and no-fluff / Documentary / Funny / Motivational)
- Audience

**Pipeline**

`angle` → `hook` → `beats` → `timing`

**Deliverables**

- `shorts-script.md`
- `captions.srt`

## YouTube SEO Pack

`youtube-seo` · Publish · SEO

Title options, a full description with chapters, tags, hashtags, pinned comment and end-screen copy — ready to paste into YouTube Studio.

**Fields**

- Video title or topic *
- Target keywords (optional)
- Audience
- Language / market (English / Bangla / Hindi / Urdu / Spanish / Arabic / Portuguese / Indonesian)

**Pipeline**

`keywords` → `titles` → `description` → `tags` → `chapters`

**Deliverables**

- `seo-pack.md`
- `metadata.json`

## Thumbnail Brief

`thumbnail-brief` · Publish · Production

The brief a designer (or you) needs: three concepts, exact overlay text, face and colour direction, and an A/B test plan.

**Fields**

- Video title *
- Audience
- Mood (Curious / Shocked / Calm and premium / Funny / Urgent)

**Pipeline**

`promise` → `concepts` → `overlay-text` → `a-b-test`

**Deliverables**

- `thumbnail-brief.md`
- `overlay-text.txt`

## Captions & Chapters

`captions` · Publish · Production

Paste or write a script and get timed SRT/VTT captions plus YouTube-style chapters and a description-ready transcript.

**Fields**

- Script or transcript *
- Seconds per caption line (2 / 3 / 4 / 5)

**Pipeline**

`split` → `time` → `export`

**Deliverables**

- `captions.srt`
- `captions.vtt`
- `chapters.md`

## Upload Checklist

`upload-checklist` · Publish · Production

The exact publish run: Studio settings, metadata, cards, end screen, subtitles, then the first hour, first 24 hours and first week.

**Fields**

- Video title *
- Audience

**Pipeline**

`pre-upload` → `studio` → `post-upload` → `first-week`

**Deliverables**

- `upload-checklist.md`
- `checklist.json`

## Channel Roadmap

`channel-roadmap` · Grow · Strategy

From zero to monetisation: what to do in week 1, month 1, month 3 and month 6, with the metrics that matter at each stage.

**Fields**

- Goal *
- Niche (optional)
- Time you can give per week (2 hours / 5 hours / 10 hours / 20+ hours)

**Pipeline**

`goal` → `phases` → `metrics` → `review`

**Deliverables**

- `roadmap.md`

## Blog & Community Post

`article-writer` · Grow · Text

Turn a video into a blog post or community post, so the same idea earns search traffic and keeps the channel active.

**Fields**

- Topic *
- Audience
- Tone (Friendly teacher / Direct and no-fluff / Documentary / Funny / Motivational)

**Pipeline**

`outline` → `draft` → `export`

**Deliverables**

- `article.md`
- `article.html`

---

## Using a tool from the API

```bash
curl -s http://127.0.0.1:9861/api/runs \
  -H 'content-type: application/json' \
  -d '{
    "tool": "video-script",
    "prompt": "how I batch a month of videos in two days",
    "fields": { "audience": "solo creators", "length": "8 minutes", "tone": "Direct" }
  }'
```

The response is the queued run. Poll `GET /api/runs/<id>` until `status` is `completed`;
`artifacts[]` then lists every file with its `url`, `mime` and byte size. Files are served
from `GET /api/artifacts/<runId>/<name>` (add `?download=1` for an attachment).

Fields marked with an asterisk are required. Anything omitted falls back to a sensible
default, so a run with just a `prompt` still produces complete documents.
