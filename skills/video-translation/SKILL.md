---
name: video-translation
description: Transcribe a video, translate the subtitles, dub the voice track and export a new video in the target language.
---

# Video Translation

Turn one video into a properly dubbed video in another language.

## When to use

- The user has a video and wants it in another language.
- The user wants subtitles in two languages at once.
- The user wants a dubbed voice track over the original video.

## Inputs to collect

| Input           | Notes                                                |
| --------------- | ---------------------------------------------------- |
| Source          | A local file or a URL (YouTube, Bilibili, TikTok, …) |
| Target language | e.g. `es-ES`, `pt-BR`, `hi-IN`, `ja-JP`              |
| Subtitle style  | Burn-in or sidecar SRT                               |
| Dubbing         | Keep the original voice, replace it, or both         |

## Steps

1. **Resolve the source**

   ```bash
   yt-dlp -f "bv*+ba/b" --merge-output-format mp4 -o "input.%(ext)s" "<url>"
   ```

   For a local file, skip this step.

2. **Extract audio**

   ```bash
   ffmpeg -i input.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le audio.wav
   ```

3. **Transcribe**

   ```bash
   whisper audio.wav --model small --output_format srt --output_dir out/
   ```

   Keep the language detection output — it becomes the source language.

4. **Translate the subtitles**
   - Translate one segment at a time; never translate the whole file at once.
   - Keep the original timestamps untouched.
   - Preserve speaker labels, sound effects in brackets (`[upbeat music]`) and numbers.
   - Target a reading speed of roughly 15 characters per second for subtitles.

5. **Dub the voice**
   - Split the translated text into chunks of at most ~220 characters on sentence
     boundaries, synthesise each chunk, and concatenate.
   - Apply a small per-chunk duration correction so the audio does not drift:
     ```
     drift = (target_duration - actual_duration) * 0.98
     ffmpeg -i chunk.wav -af "atempo=<factor>" chunk_fixed.wav
     ```

6. **Render**

   ```bash
   ffmpeg -i input.mp4 -i dubbed.wav -i translated.srt \
     -map 0:v -map 1:a -map 2 -c:v copy -c:a aac -c:s mov_text \
     -metadata:s:s:0 language=es output.mp4
   ```

7. **Deliver**
   - `output.mp4` — the dubbed video
   - `translated.srt` — the sidecar subtitles
   - `dubbed.wav` — the voice track on its own

## Failure modes

| Problem                          | Response                                                      |
| -------------------------------- | ------------------------------------------------------------- |
| `yt-dlp` missing                 | Say so and offer the local-file path instead                  |
| `whisper` missing                | Fall back to platform subtitles when the source has them      |
| Audio and subtitles drift        | Re-run step 5 with a stricter `atempo` factor, chunk by chunk |
| Target language has no TTS voice | Report the unsupported language and offer subtitles only      |

## Studio integration

The same pipeline is available as the `video-translation` tool in the studio.
Start it from _Creator tools → Video Translation_, or drive it programmatically:

```ts
await client.createRun({ tool: 'video-translation', projectId, title: 'Teaser — ES' });
```
