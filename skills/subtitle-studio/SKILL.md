---
name: subtitle-studio
description: Download, transcribe, translate, style and burn in subtitles for any video or audio file.
---

# Subtitle Studio

Produce accurate, well-timed subtitles — as a sidecar file, a bilingual track, or burned in.

## When to use

- A video needs subtitles for accessibility or reach.
- Existing subtitles need translating, re-timing or restyling.
- A short-form video needs punchy, large captions.

## Steps

1. **Get the media**
   - Local file → use it directly.
   - URL → `yt-dlp -f "bv*+ba/b" --merge-output-format mp4 -o "input.%(ext)s" "<url>"`

2. **Try platform subtitles first**

   ```bash
   yt-dlp --write-auto-subs --write-subs --sub-langs "en.*,en" --skip-download "<url>"
   ```

   Platform captions are usually better and cheaper than a transcription pass.

3. **Transcribe when there are none**

   ```bash
   whisper input.mp4 --model small --output_format srt --output_dir out/
   ```

4. **Clean the subtitles**
   - Merge lines that are split mid-sentence.
   - Remove duplicate or overlapping captions.
   - Cap the reading speed; split anything longer than ~42 characters per line.
   - Add `{\an8}` position tags only for short-form vertical presets.

5. **Translate** (optional)
   - Translate per segment, keeping the timing identical.
   - Produce either a translated file or a bilingual file
     (original on line 1, translation on line 2).

6. **Style** (optional)

   | Preset       | Font size | Outline | Position |
   | ------------ | --------- | ------- | -------- |
   | `clean`      | 28        | 2       | bottom   |
   | `short-form` | 64        | 6       | center   |
   | `podcast`    | 22        | 1       | bottom   |

7. **Burn in**

   ```bash
   ffmpeg -i input.mp4 -vf "subtitles=subtitles.srt:force_style='FontSize=28,Outline=2'" \
     -c:a copy output.mp4
   ```

8. **Deliver** — `output.mp4` (burned in), `subtitles.srt` (sidecar), `bilingual.srt`.

## Failure modes

| Problem                 | Response                                                  |
| ----------------------- | --------------------------------------------------------- |
| Language not detected   | Pass `--language en` explicitly to whisper                |
| Caption drift over time | Re-sync with `ffmpeg -itsoffset` and check on a long file |
| Font not found          | Use `fontsdir=` in `force_style` or install the font      |

## Studio integration

Available as the `subtitle-studio` tool — pipeline `transcribe → translate → style → render`.
