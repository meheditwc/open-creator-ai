import { writeFile } from 'node:fs/promises';
import type { AppSettings } from '@open-creator/shared';
import { ffmpeg } from './media.ts';

/**
 * Image generation.
 *
 * Three tiers, tried in order, so a creator always gets a picture:
 *
 * 1. `provider` — the OpenAI-compatible `/images/generations` endpoint of
 *    whatever base URL is configured in Settings (OpenAI, Together, a free
 *    router, a local Automatic1111 proxy…). This is the best quality.
 * 2. `keyless`  — a keyless public image service (Pollinations), so a fresh
 *    install produces real AI art with no account and no key.
 * 3. `local`    — procedural art rendered by ffmpeg from the prompt (fractal +
 *    gradient + grain). Never a flat rectangle with text on it.
 */

export type ImageSource = 'provider' | 'keyless' | 'local';

export interface ImageResult {
  path: string;
  source: ImageSource;
  model?: string;
  prompt: string;
}

export interface ImageRequest {
  prompt: string;
  width: number;
  height: number;
  outPath: string;
  /** Style suffix appended to the prompt (photographic, poster, …). */
  style?: string;
  seed?: number;
}

const DEFAULT_STYLE =
  'cinematic, dramatic lighting, high detail, rich colour, clean composition, no text, no watermark';

/** Keyless endpoint base. Overridable so tests can point at a local stub. */
function keylessEndpoint(): string {
  return (process.env.OPENCREATOR_IMAGE_URL ?? 'https://image.pollinations.ai/prompt').replace(
    /\/$/,
    '',
  );
}

function buildPrompt(request: ImageRequest): string {
  const style = request.style ?? DEFAULT_STYLE;
  return `${request.prompt.trim().slice(0, 800)}, ${style}`;
}

async function writeBuffer(path: string, response: Response): Promise<number> {
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 2_000) throw new Error('image response was too small to be an image');
  await writeFile(path, buffer);
  return buffer.byteLength;
}

/* -------------------------------------------------------------------------- */
/* 1. Provider                                                                 */
/* -------------------------------------------------------------------------- */

async function fromProvider(
  settings: AppSettings,
  request: ImageRequest,
  prompt: string,
): Promise<ImageResult | null> {
  const { baseUrl, apiKey, imageModel } = settings.llm;
  if (!baseUrl || !apiKey || !imageModel) return null;

  const endpoint = baseUrl.replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${endpoint}/images/generations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: imageModel,
        prompt,
        n: 1,
        size: `${request.width}x${request.height}`,
        response_format: 'b64_json',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`image provider responded with ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      data?: { b64_json?: string; url?: string }[];
    };
    const first = payload.data?.[0];
    if (first?.b64_json) {
      const buffer = Buffer.from(first.b64_json, 'base64');
      if (buffer.byteLength < 2_000) throw new Error('provider returned an empty image');
      await writeFile(request.outPath, buffer);
      return { path: request.outPath, source: 'provider', model: imageModel, prompt };
    }
    if (first?.url) {
      const image = await fetch(first.url, { signal: controller.signal });
      if (!image.ok) throw new Error(`could not download the generated image (${image.status})`);
      await writeBuffer(request.outPath, image);
      return { path: request.outPath, source: 'provider', model: imageModel, prompt };
    }
    throw new Error('provider returned no image data');
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Keyless                                                                  */
/* -------------------------------------------------------------------------- */

async function fromKeyless(
  settings: AppSettings,
  request: ImageRequest,
  prompt: string,
): Promise<ImageResult | null> {
  if (settings.keylessImages === false) return null;

  const params = new URLSearchParams({
    width: String(request.width),
    height: String(request.height),
    nologo: 'true',
    seed: String(request.seed ?? Math.floor(Math.random() * 1_000_000)),
    model: process.env.OPENCREATOR_KEYLESS_IMAGE_MODEL ?? 'flux',
  });
  const url = `${keylessEndpoint()}/${encodeURIComponent(prompt)}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`keyless image service responded with ${response.status}`);
    }
    await writeBuffer(request.outPath, response);
    return { path: request.outPath, source: 'keyless', prompt };
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Local procedural art                                                     */
/* -------------------------------------------------------------------------- */

/** Deterministic hash so the same prompt always renders the same artwork. */
function seedOf(text: string): number {
  let hash = 7;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 999_983;
  }
  return hash;
}

/**
 * Abstract art built from the prompt itself: a fractal field, two coloured
 * gradients and a grain layer, mixed with `blend`. It is not a photo, but it
 * reads as artwork rather than "a box with text in it".
 */
export async function proceduralArt(
  ffmpegPath: string,
  request: ImageRequest & { palette?: { from: string; to: string; accent: string } },
): Promise<ImageResult> {
  const { width, height } = request;
  const seed = request.seed ?? seedOf(request.prompt);
  const palette = request.palette ?? { from: '#1b1035', to: '#07070c', accent: '#7c5cff' };

  // Zoom/offset derived from the seed so different prompts look different.
  const zoom = 1.4 + (seed % 90) / 100;
  const inner = 0.6 + ((seed >> 3) % 40) / 100;
  const start = (seed % 1000) / 1000;

  const filters = [
    // Fractal field, hue-shifted and blurred into a painterly backdrop.
    `format=rgb24`,
    `hue=h=${seed % 360}:s=1.5`,
    `boxblur=12:2`,
    `eq=contrast=1.25:brightness=-0.06:saturation=1.35`,
    `scale=${width}:${height}`,
  ].join(',');

  await ffmpeg(
    ffmpegPath,
    [
      '-f',
      'lavfi',
      '-i',
      `mandelbrot=s=${width}x${height}:maxiter=180:start_scale=${zoom.toFixed(
        2,
      )}:end_scale=${inner.toFixed(2)}:start_x=${start.toFixed(3)}`,
      '-f',
      'lavfi',
      '-i',
      `gradients=s=${width}x${height}:c0=${toFfColor(palette.from)}:c1=${toFfColor(
        palette.to,
      )}:c2=${toFfColor(palette.accent)}@0.45:nb_colors=3:x0=0:y0=0:x1=${width}:y1=${height}:d=1`,
      '-filter_complex',
      `[0:v]${filters}[art];[1:v]format=rgb24[plate];` +
        `[plate][art]blend=all_mode=softlight:all_opacity=0.85,` +
        `noise=alls=12:allf=t+u,vignette=PI/5,format=rgb24[out]`,
      '-map',
      '[out]',
      '-frames:v',
      '1',
      '-update',
      '1',
      request.outPath,
    ],
    { timeoutMs: 180_000 },
  );

  return { path: request.outPath, source: 'local', prompt: request.prompt };
}

function toFfColor(color: string): string {
  return `0x${color.replace('#', '')}`;
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                          */
/* -------------------------------------------------------------------------- */

export interface GenerateOptions {
  settings: AppSettings;
  ffmpegPath: string;
  request: ImageRequest;
  /** Called with human-readable progress, and with any tier that failed. */
  onFallback?: (source: ImageSource, reason: string) => void;
}

/** Try every tier and always return something usable. */
export async function generateImage(options: GenerateOptions): Promise<ImageResult> {
  const { settings, request, onFallback } = options;
  const prompt = buildPrompt(request);

  try {
    const result = await fromProvider(settings, request, prompt);
    if (result) return result;
  } catch (error) {
    const reason =
      error instanceof Error
        ? `${error.message}${(error as { cause?: { code?: string } }).cause?.code ? ` (${(error as { cause?: { code?: string } }).cause?.code})` : ''}`
        : String(error);
    onFallback?.('provider', reason);
  }

  try {
    const result = await fromKeyless(settings, request, prompt);
    if (result) return result;
  } catch (error) {
    const reason =
      error instanceof Error
        ? `${error.message}${(error as { cause?: { code?: string } }).cause?.code ? ` (${(error as { cause?: { code?: string } }).cause?.code})` : ''}`
        : String(error);
    onFallback?.('keyless', reason);
  }

  return proceduralArt(options.ffmpegPath, request);
}

/** True when *some* image tier can plausibly run (used for capabilities). */
export function imageCapability(settings: AppSettings): {
  provider: boolean;
  keyless: boolean;
  effective: ImageSource;
} {
  const provider = Boolean(settings.llm.baseUrl && settings.llm.apiKey && settings.llm.imageModel);
  const keyless = settings.keylessImages !== false;
  return {
    provider,
    keyless,
    effective: provider ? 'provider' : keyless ? 'keyless' : 'local',
  };
}
