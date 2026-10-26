import { writeFile } from 'node:fs/promises';
import type { LlmSettings } from '@open-creator/shared';
import { LlmClient } from './llm.ts';

/**
 * Optional provider features.
 *
 * These are the only paths that need an API key: text translation (for
 * subtitles) and speech synthesis (for voiceovers). Everything else in the
 * studio renders locally with ffmpeg.
 */

function endpoint(settings: LlmSettings): string {
  return settings.baseUrl.replace(/\/$/, '');
}

function authorized(settings: LlmSettings): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;
  return headers;
}

/** True when a key is present — we do not probe here, the render path will. */
export function providerConfigured(settings: LlmSettings): boolean {
  return Boolean(settings.baseUrl && settings.apiKey);
}

/** Translate plain text with the OpenAI-compatible chat endpoint. */
export async function translateText(
  settings: LlmSettings,
  text: string,
  targetLanguage: string,
): Promise<string> {
  const client = new LlmClient({ ...settings, model: settings.fastModel || settings.model });
  const result = await client.chat(
    'You translate subtitles. Reply with the translated text only, keeping line breaks and nothing else.',
    `Translate into ${targetLanguage}:\n\n${text}`,
    60_000,
  );
  return result.content.trim();
}

/**
 * Synthesize speech through the OpenAI-compatible `/audio/speech` endpoint.
 * Writes an mp3 next to `outPath` and returns the path.
 */
export async function synthesizeSpeech(
  settings: LlmSettings,
  text: string,
  outPath: string,
  options: { voice?: string; language?: string } = {},
): Promise<string> {
  const response = await fetch(`${endpoint(settings)}/audio/speech`, {
    method: 'POST',
    headers: authorized(settings),
    body: JSON.stringify({
      model: process.env.OPENCREATOR_TTS_MODEL ?? 'tts-1',
      voice: options.voice ?? process.env.OPENCREATOR_TTS_VOICE ?? 'alloy',
      input: text,
      response_format: 'mp3',
      ...(options.language ? { language: options.language } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `speech provider responded with ${response.status} ${response.statusText} — check the TTS model in Settings`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 1000) throw new Error('speech provider returned an empty audio file');
  await writeFile(outPath, buffer);
  return outPath;
}
