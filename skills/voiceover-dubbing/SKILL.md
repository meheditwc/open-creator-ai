---
name: voiceover-dubbing
description: Generate a natural voice-over from text or subtitles and align it with the visuals.
---

# Voiceover & Dubbing

Create a voice track that sounds intentional, not synthetic.

## When to use

- A video needs narration in a language it was not shot in.
- A script needs to be read aloud.
- An existing voice track needs to be replaced or cleaned up.

## Steps

1. **Collect the text**
   - From subtitles: read the `.srt` and strip the timing.
   - From a script: use it as written, but mark emphasis with punctuation, not caps.

2. **Chunk it**
   - Split on sentence boundaries; never exceed ~220 characters per chunk.
   - Split on paragraph breaks so the voice gets natural breaths.
   - Keep numbers and abbreviations expanded (`$1.2M` → _one point two million_).

3. **Synthesize**
   - One request per chunk, with the same voice id and the same settings — this is
     what keeps the tone consistent.
   - Pick the voice for the _scene_, not the person: explainer, documentary,
     energetic, warm, documentary narrator.

4. **Align**
   - Measure the actual duration of every chunk.
   - Compute `atempo` per chunk to match the target slot, but clamp the factor to
     `0.9 – 1.1` — beyond that the voice sounds wrong.
   - Add ~120 ms of silence between chunks.

5. **Mix**

   ```bash
   ffmpeg -i voice.wav -i original.mp4 -filter_complex \
     "[0:a]volume=1.0[voice];[1:a]volume=0.15[bgm];[voice][bgm]amix=inputs=2:duration=first[a]" \
     -map "[a]" -map 1:v -c:a aac output.mp4
   ```

   Duck the original audio to 10–20 % under the voice.

6. **Deliver** — `voice.wav`, `output.mp4`, and the chunk manifest (text → file → duration).

## Failure modes

| Problem                  | Response                                                           |
| ------------------------ | ------------------------------------------------------------------ |
| Voice sounds flat        | Add a short pause marker or split a long sentence                  |
| Timing cannot be matched | Leave the original audio and deliver the voice as a separate track |
| Chunk durations drift    | Re-align chunk by chunk instead of resampling the whole file       |

## Studio integration

Available as the `voiceover` tool — pipeline `chunk → synthesize → align`.
