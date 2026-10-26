import { writeFile } from 'node:fs/promises';
import { TOOLS } from '@open-creator/shared';
import { join } from 'node:path';
import { ffmpeg } from './media.ts';
import type { ImageResult, ImageSource } from './imagegen.ts';
import type { AppSettings } from '@open-creator/shared';
import {
  type Cue,
  type ShortScript,
  buildArticle,
  buildPlan,
  buildShortScript,
  chunkSentence,
  cuesFromScript,
  cuesFromText,
  toSrt,
  toVtt,
  topicFrom,
} from './creative.ts';

/**
 * The render layer.
 *
 * Posters, clips with burned-in captions and stick-figure animation are all
 * produced with ffmpeg from generated ASS subtitles, so the studio ships real
 * files (PNG / MP4 / SRT / VTT / MD / HTML) without a model provider, a GPU or
 * a native node module.
 */

export type ArtifactKind = 'image' | 'video' | 'audio' | 'text' | 'subtitle' | 'document';

export interface ProducedFile {
  name: string;
  kind: ArtifactKind;
  note?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface RenderContext {
  ffmpegPath: string;
  /** Current settings (provider + keyless image preference). */
  settings: AppSettings;
  /** Generate one image for a prompt and report which tier produced it. */
  makeImage: (options: {
    prompt: string;
    width: number;
    height: number;
    out: string;
    style?: string;
    palette?: { from: string; to: string; accent: string };
  }) => Promise<ImageResult>;
  /** Tiers that were unavailable, for the run notes. */
  imageNotes: string[];
  /** Directory that becomes `/api/artifacts/<runId>/`. */
  workDir: string;
  /** Report progress (0–100) and the current stage. */
  report: (progress: number, message: string) => Promise<void>;
  /** Attach a note to the run (for example, what still needs a provider). */
  note: (message: string) => void;
}

export type Aspect = '16:9' | '9:16' | '1:1';

export interface RenderInput {
  /** The creator's prompt / topic. */
  prompt: string;
  /** Optional source URL or text pasted into the run. */
  sourceUrl?: string;
  language?: string;
  aspect?: Aspect;
  durationSeconds?: number;
  variants?: number;
  /** Run title, used for file names and the on-screen kicker. */
  title: string;
}

export const DIMENSIONS: Record<Aspect, { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1': { width: 1080, height: 1080 },
};

interface Theme {
  from: string;
  to: string;
  accent: string;
  ink: string;
}

const THEMES: Record<string, Theme> = {
  default: { from: '#1b1035', to: '#07070c', accent: '#7c5cff', ink: '#ffffff' },
  'thumbnail-generator': { from: '#2a1220', to: '#0b0a14', accent: '#ff7a45', ink: '#ffffff' },
  'image-generation': { from: '#26102a', to: '#0a0a14', accent: '#ff5c8a', ink: '#ffffff' },
  'video-generation': { from: '#0b1b3a', to: '#05060d', accent: '#3b82f6', ink: '#ffffff' },
  'video-translation': { from: '#171032', to: '#07070c', accent: '#7c5cff', ink: '#ffffff' },
  'video-downloader': { from: '#052622', to: '#05070c', accent: '#00b3a4', ink: '#ffffff' },
  'short-script': { from: '#2a1a05', to: '#0c0a06', accent: '#f59e0b', ink: '#ffffff' },
  'stick-figure': { from: '#1d1030', to: '#08070f', accent: '#a855f7', ink: '#ffffff' },
  voiceover: { from: '#2a0f1f', to: '#0a0609', accent: '#ec4899', ink: '#ffffff' },
  'subtitle-studio': { from: '#05202e', to: '#05070c', accent: '#0ea5e9', ink: '#ffffff' },
  'article-writer': { from: '#0a2417', to: '#05080a', accent: '#22c55e', ink: '#ffffff' },
  'workflow-planner': { from: '#141a24', to: '#07080c', accent: '#94a3b8', ink: '#ffffff' },
};

function themeFor(toolId: string): Theme {
  return THEMES[toolId] ?? THEMES.default;
}

/** `#ff7a45` → `0xff7a45` (ffmpeg colour literal). */
function ff(color: string): string {
  return `0x${color.replace('#', '')}`;
}

/** `#ff7a45` → `&H00457AFF` (ASS is &HAABBGGRR). */
function assColor(color: string): string {
  const hex = color.replace('#', '');
  const r = hex.slice(0, 2);
  const g = hex.slice(2, 4);
  const b = hex.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function assTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.round((safe % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Strip ASS control sequences from user text and wrap it to a readable width. */
function clean(text: string): string {
  return text.replace(/[{}]/g, '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function wrap(text: string, maxChars: number): string {
  const words = clean(text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= maxChars) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join('\\N');
}

/** Trim text to a single line budget, with an ellipsis when it is cut. */
function truncate(text: string, maxChars: number): string {
  const value = clean(text);
  return value.length <= maxChars
    ? value
    : `${value.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

/** Rough character budget for a given font size and available width. */
function charsPerLine(availableWidth: number, fontSize: number): number {
  return Math.max(8, Math.floor(availableWidth / (fontSize * 0.56)));
}

interface AssStyle {
  name: string;
  font: string;
  size: number;
  color: string;
  bold?: boolean;
  borderStyle?: 1 | 3;
  outline?: number;
  shadow?: number;
  alignment?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  marginL?: number;
  marginR?: number;
  marginV?: number;
  back?: string;
  spacing?: number;
  /** Outline/border colour — for vector drawings this is the stroke. */
  outlineColor?: string;
}

interface AssCue {
  start: number;
  end: number;
  text: string;
  style: string;
  /** Extra override tags placed before the text. */
  tags?: string;
}

const FONT_STACK = process.env.OPENCREATOR_FONT ?? 'DejaVu Sans';

function styleLine(style: AssStyle): string {
  const borderStyle = style.borderStyle ?? 1;
  const outline = style.outline ?? (borderStyle === 3 ? 12 : 2);
  return [
    `Style: ${style.name}`,
    style.font,
    style.size,
    assColor(style.color),
    assColor(style.color),
    assColor(style.outlineColor ?? '#000000'),
    assColor(style.back ?? '#000000'),
    style.bold ? -1 : 0,
    0,
    0,
    0,
    100,
    100,
    style.spacing ?? 0,
    0,
    borderStyle,
    outline,
    style.shadow ?? 0,
    style.alignment ?? 2,
    style.marginL ?? 60,
    style.marginR ?? 60,
    style.marginV ?? 60,
    1,
  ].join(',');
}

function assDocument(options: {
  width: number;
  height: number;
  styles: AssStyle[];
  cues: AssCue[];
}): string {
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${options.width}`,
    `PlayResY: ${options.height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...options.styles.map(styleLine),
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...options.cues.map(
      (cue) =>
        `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},${cue.style},,0,0,0,,${cue.tags ?? ''}${cue.text}`,
    ),
    '',
  ].join('\n');
}

/* -------------------------------------------------------------------------- */
/* ffmpeg helpers                                                              */
/* -------------------------------------------------------------------------- */

function gradientSource(theme: Theme, width: number, height: number, duration: number): string {
  return [
    `gradients=s=${width}x${height}`,
    `c0=${ff(theme.from)}`,
    `c1=${ff(theme.to)}`,
    `nb_colors=3`,
    `c2=${ff(theme.accent)}@0.14`,
    `x0=0`,
    `y0=0`,
    `x1=${width}`,
    `y1=${height}`,
    `d=${duration}`,
    `speed=${duration > 1 ? 0.012 : 0}`,
  ].join(':');
}

async function renderPoster(
  ctx: RenderContext,
  theme: Theme,
  options: {
    out: string;
    width: number;
    height: number;
    ass?: { name: string; content: string };
    extraFilters?: string[];
  },
): Promise<void> {
  const { out, width, height } = options;
  const filters: string[] = [];
  // Gradient first, then the darkening layer, and only then the text, so the
  // type is never dimmed by the overlay.
  filters.push(`drawbox=x=0:y=0:w=${width}:h=${height}:color=black@0.34:t=fill`);
  filters.push(...(options.extraFilters ?? []));
  if (options.ass) {
    await writeFile(join(ctx.workDir, options.ass.name), options.ass.content, 'utf8');
    filters.push(`ass=${options.ass.name}`);
  }
  filters.push('format=rgb24');

  await ffmpeg(
    ctx.ffmpegPath,
    [
      '-f',
      'lavfi',
      '-i',
      gradientSource(theme, width, height, 1),
      '-vf',
      filters.join(','),
      '-frames:v',
      '1',
      '-update',
      '1',
      out,
    ],
    { cwd: ctx.workDir },
  );
}

/**
 * Draw ASS text on top of an existing image (AI art) instead of a gradient.
 * A soft scrim goes in first so white type stays readable on any photo.
 */
async function overlayOnImage(
  ctx: RenderContext,
  options: {
    imagePath: string;
    out: string;
    ass: { name: string; content: string };
    scrim?: 'none' | 'bottom' | 'full';
  },
): Promise<void> {
  await writeFile(join(ctx.workDir, options.ass.name), options.ass.content, 'utf8');
  const filters: string[] = [];
  if (options.scrim === 'bottom') {
    filters.push('drawbox=x=0:y=ih*0.52:w=iw:h=ih*0.48:color=black@0.55:t=fill');
  } else if (options.scrim === 'full') {
    filters.push('drawbox=x=0:y=0:w=iw:h=ih:color=black@0.32:t=fill');
  }
  filters.push(`ass=${options.ass.name}`, 'format=rgb24');

  await ffmpeg(
    ctx.ffmpegPath,
    [
      '-i',
      options.imagePath,
      '-vf',
      filters.join(','),
      '-frames:v',
      '1',
      '-update',
      '1',
      options.out,
    ],
    { cwd: ctx.workDir },
  );
}

async function renderClip(
  ctx: RenderContext,
  theme: Theme,
  options: {
    out: string;
    width: number;
    height: number;
    duration: number;
    ass: { name: string; content: string };
    extraFilters?: string[];
    audioFile?: string;
    backdrop?: string;
  },
): Promise<void> {
  const { out, width, height, duration } = options;
  await writeFile(join(ctx.workDir, options.ass.name), options.ass.content, 'utf8');
  const filters = [
    // Darken the plate first: captions stay legible and stay white.
    `drawbox=x=0:y=0:w=${width}:h=${height}:color=black@0.28:t=fill`,
    ...(options.extraFilters ?? []),
    `ass=${options.ass.name}`,
    'format=yuv420p',
  ];

  // With a backdrop we take one still and slowly push in, which reads as motion.
  const backdropFilters = options.backdrop
    ? `scale=${width * 1.25}:${height * 1.25}:force_original_aspect_ratio=increase,` +
      `crop=${width * 1.25}:${height * 1.25},` +
      `zoompan=z='min(zoom+0.0006,1.18)':d=${Math.round(duration * 30)}:s=${width}x${height}:fps=30,` +
      `format=rgb24`
    : 'null';

  const inputs = options.backdrop
    ? ['-loop', '1', '-t', String(duration), '-i', options.backdrop]
    : ['-f', 'lavfi', '-i', gradientSource(theme, width, height, duration)];

  inputs.push(
    ...(options.audioFile
      ? ['-i', options.audioFile]
      : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']),
  );

  await ffmpeg(
    ctx.ffmpegPath,
    [
      ...inputs,
      '-filter_complex',
      `[0:v]${backdropFilters},${filters.join(',')}[v]`,
      '-map',
      '[v]',
      '-map',
      '1:a',
      '-t',
      String(duration),
      '-r',
      '30',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '26',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-shortest',
      '-movflags',
      '+faststart',
      out,
    ],
    { cwd: ctx.workDir, timeoutMs: 300_000 },
  );
}

/* -------------------------------------------------------------------------- */
/* Poster renderers                                                            */
/* -------------------------------------------------------------------------- */

interface PosterCopy {
  kicker: string;
  title: string;
  footer: string;
}

function posterStyles(theme: Theme, width: number): AssStyle[] {
  const scale = width >= 1080 ? 1 : 0.78;
  return [
    {
      name: 'Kicker',
      font: FONT_STACK,
      size: Math.round(30 * scale),
      color: theme.accent,
      bold: true,
      alignment: 7,
      marginL: 72,
      marginV: 72,
      spacing: 3,
    },
    {
      name: 'Title',
      font: FONT_STACK,
      size: Math.round(84 * scale),
      color: theme.ink,
      bold: true,
      alignment: 4,
      marginL: 72,
      marginR: 96,
    },
    {
      name: 'TitleCenter',
      font: FONT_STACK,
      size: Math.round(96 * scale),
      color: theme.ink,
      bold: true,
      alignment: 5,
      marginL: 96,
      marginR: 96,
    },
    {
      name: 'TitleBox',
      font: FONT_STACK,
      size: Math.round(76 * scale),
      color: theme.ink,
      bold: true,
      borderStyle: 1,
      outline: 6,
      shadow: 2,
      alignment: 1,
      marginL: 72,
      marginR: 96,
      // Clear of the footer line, which sits at marginV 34.
      marginV: 104,
    },
    {
      name: 'Footer',
      font: FONT_STACK,
      size: Math.round(26 * scale),
      color: '#c8c8d8',
      alignment: 1,
      marginL: 72,
      marginV: 34,
    },
  ];
}

function posterCues(
  layout: 'center' | 'lower' | 'left',
  copy: PosterCopy,
  width: number,
  styles: AssStyle[],
): AssCue[] {
  const sizeOf = (name: string, fallback: number) =>
    styles.find((style) => style.name === name)?.size ?? fallback;

  const titleStyle = layout === 'center' ? 'TitleCenter' : layout === 'left' ? 'TitleBox' : 'Title';
  const titleSize = sizeOf(titleStyle, 84);
  const titleWidth = layout === 'left' ? width * 0.6 : width - 190;

  // No \fad here: a poster is a single frame taken at t=0, where a fade-in is
  // still fully transparent.
  return [
    {
      start: 0,
      end: 10,
      text: wrap(copy.kicker.toUpperCase(), charsPerLine(width - 144, sizeOf('Kicker', 30))),
      style: 'Kicker',
    },
    {
      start: 0,
      end: 10,
      text: wrap(copy.title, charsPerLine(titleWidth, titleSize)),
      style: titleStyle,
      tags: '{\\fsp1}',
    },
    {
      start: 0,
      end: 10,
      text: wrap(copy.footer, charsPerLine(width - 144, sizeOf('Footer', 26))),
      style: 'Footer',
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Video renderers                                                             */
/* -------------------------------------------------------------------------- */

function captionStyles(theme: Theme, width: number, height: number): AssStyle[] {
  const scale = width >= 1000 ? 1 : width / 720;
  const base = Math.round(52 * scale);
  return [
    {
      name: 'Stage',
      font: FONT_STACK,
      size: Math.round(26 * scale),
      color: theme.accent,
      bold: true,
      alignment: 7,
      marginL: 56,
      marginV: 56,
      spacing: 3,
    },
    {
      name: 'Caption',
      font: FONT_STACK,
      size: base,
      color: '#ffffff',
      bold: true,
      borderStyle: 1,
      outline: Math.round(5 * scale),
      shadow: 2,
      alignment: 2,
      marginL: 64,
      marginR: 64,
      marginV: Math.round(height * 0.12),
    },
    {
      name: 'Beat',
      font: FONT_STACK,
      size: Math.round(24 * scale),
      color: theme.accent,
      bold: true,
      alignment: 2,
      marginL: 64,
      // Sits just above the caption block, which starts at 12% of the height.
      marginV: Math.round(height * 0.12) + Math.round(base * 2.6),
      spacing: 2,
    },
    {
      name: 'Title',
      font: FONT_STACK,
      size: Math.round(72 * scale),
      color: '#ffffff',
      bold: true,
      alignment: 5,
      marginL: 72,
      marginR: 72,
    },
  ];
}

/** Build the caption-driven clip used by script / caption / teaser renders. */
async function makeCaptionClip(
  ctx: RenderContext,
  toolId: string,
  options: {
    out: string;
    width: number;
    height: number;
    duration: number;
    cues: Cue[];
    stage: string;
    title?: string;
    extraFilters?: string[];
    audioFile?: string;
    /** A still image used as the moving backdrop (AI art or procedural). */
    backdrop?: string;
  },
): Promise<void> {
  const theme = themeFor(toolId);
  const styles = captionStyles(theme, options.width, options.height);
  const stageSize = styles.find((style) => style.name === 'Stage')?.size ?? 26;
  const cues: AssCue[] = [
    {
      start: 0,
      end: options.duration,
      text: truncate(options.stage.toUpperCase(), charsPerLine(options.width - 112, stageSize)),
      style: 'Stage',
      tags: '{\\fad(200,200)}',
    },
    ...options.cues.map((cue) => ({
      start: cue.start,
      end: Math.min(cue.end, options.duration),
      text: wrap(
        cue.text,
        charsPerLine(
          options.width - 128,
          styles.find((style) => style.name === 'Caption')?.size ?? 52,
        ),
      ),
      style: 'Caption',
      tags: '{\\fad(160,160)}',
    })),
  ];

  await renderClip(ctx, theme, {
    out: options.out,
    width: options.width,
    height: options.height,
    duration: options.duration,
    ass: {
      name: `${options.out}.ass`,
      content: assDocument({ width: options.width, height: options.height, styles, cues }),
    },
    extraFilters: options.extraFilters,
    audioFile: options.audioFile,
  });
}

/**
 * ASS vector drawing of a stick figure — no image assets needed.
 *
 * The drawing is authored in a 240×280 unit box centred on (0, 0): strokes are
 * the outline colour, so the style must set `outlineColor` to the visible one.
 */
const FIGURE_BOX = { width: 150, height: 250 };
function stickFigure(pose: 'idle' | 'wave' | 'point' | 'walk'): string {
  const cx = 0;
  const cy = 0;
  const headRadius = 22;
  const headCenter = { x: cx, y: cy - 96 };
  const points: string[] = [];

  // Head: 16-point polygon.
  const head: string[] = [];
  for (let index = 0; index <= 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const x = Math.round(headCenter.x + Math.cos(angle) * headRadius);
    const y = Math.round(headCenter.y + Math.sin(angle) * headRadius);
    head.push(`${index === 0 ? 'm' : 'l'} ${x} ${y}`);
  }
  points.push(head.join(' '));

  const segment = (x1: number, y1: number, x2: number, y2: number) => `m ${x1} ${y1} l ${x2} ${y2}`;

  // Body.
  points.push(segment(cx, cy - 74, cx, cy + 20));

  // Arms.
  if (pose === 'wave') {
    points.push(segment(cx, cy - 58, cx - 52, cy - 34));
    points.push(segment(cx, cy - 58, cx + 46, cy - 108));
    points.push(segment(cx + 46, cy - 108, cx + 64, cy - 132));
  } else if (pose === 'point') {
    points.push(segment(cx, cy - 58, cx - 44, cy - 30));
    points.push(segment(cx, cy - 58, cx + 66, cy - 74));
  } else if (pose === 'walk') {
    points.push(segment(cx, cy - 58, cx - 46, cy - 20));
    points.push(segment(cx, cy - 58, cx + 42, cy - 96));
  } else {
    points.push(segment(cx, cy - 58, cx - 46, cy - 12));
    points.push(segment(cx, cy - 58, cx + 46, cy - 12));
  }

  // Legs.
  if (pose === 'walk') {
    points.push(segment(cx, cy + 20, cx - 40, cy + 96));
    points.push(segment(cx, cy + 20, cx + 42, cy + 92));
  } else {
    points.push(segment(cx, cy + 20, cx - 30, cy + 100));
    points.push(segment(cx, cy + 20, cx + 30, cy + 100));
  }

  return points.join(' ');
}

async function makeStickFigureClip(
  ctx: RenderContext,
  options: {
    out: string;
    width: number;
    height: number;
    duration: number;
    script: ShortScript;
  },
): Promise<void> {
  const theme = themeFor('stick-figure');
  const styles = captionStyles(theme, options.width, options.height);
  const poses: ('idle' | 'wave' | 'point' | 'walk')[] = ['wave', 'idle', 'point', 'walk', 'wave'];

  const stageSize = styles.find((style) => style.name === 'Stage')?.size ?? 26;
  const cues: AssCue[] = [
    {
      start: 0,
      end: options.duration,
      text: truncate(
        options.script.title.toUpperCase(),
        charsPerLine(options.width - 112, stageSize),
      ),
      style: 'Stage',
      tags: '{\\fad(200,200)}',
    },
  ];

  const captionSize =
    styles.find((style) => style.name === 'Caption')?.size ?? Math.round(options.height * 0.08);
  const figureScale = Math.round((options.height * 0.32 * 100) / FIGURE_BOX.height);

  options.script.beats.forEach((beat, index) => {
    const pose = poses[index % poses.length];
    const x = Math.round(options.width * 0.5);
    const y = Math.round(options.height * 0.44);
    cues.push({
      start: beat.start,
      end: beat.end,
      text: `{\\p1}${stickFigure(pose)}{\\p0}`,
      style: 'Figure',
      tags: `{\\pos(${x},${y})\\fscx${figureScale}\\fscy${figureScale}\\fad(150,150)\\t(0,${Math.round(
        (beat.end - beat.start) * 1000,
      )},\\frz${index % 2 === 0 ? 1.5 : -1.5})}`,
    });
    cues.push({
      start: beat.start,
      end: beat.end,
      text: wrap(beat.text, charsPerLine(options.width - 200, captionSize)),
      style: 'Caption',
      tags: '{\\fad(160,160)}',
    });
    cues.push({
      start: beat.start,
      end: beat.end,
      text: beat.label.toUpperCase(),
      style: 'Beat',
      tags: '{\\fad(160,160)}',
    });
  });

  const figureStyle: AssStyle = {
    name: 'Figure',
    font: FONT_STACK,
    size: 100,
    color: '#ffffff',
    outlineColor: '#ffffff',
    bold: true,
    outline: 9,
    alignment: 5,
    marginV: 0,
  };

  await renderClip(ctx, theme, {
    out: options.out,
    width: options.width,
    height: options.height,
    duration: options.duration,
    ass: {
      name: `${options.out}.ass`,
      content: assDocument({
        width: options.width,
        height: options.height,
        styles: [...styles, figureStyle],
        cues,
      }),
    },
    extraFilters: [
      `drawbox=x=0:y=${options.height - 12}:w=${options.width}:h=12:color=${ff(theme.accent)}@0.9:t=fill`,
    ],
  });
}

/* -------------------------------------------------------------------------- */
/* Tool renderers                                                              */
/* -------------------------------------------------------------------------- */

function resolveDims(
  input: RenderInput,
  fallback: Aspect = '16:9',
): { width: number; height: number } {
  return DIMENSIONS[input.aspect ?? fallback];
}

function clampDuration(input: RenderInput, fallback = 8): number {
  const requested = Number(input.durationSeconds);
  if (!Number.isFinite(requested) || requested <= 0) return fallback;
  return Math.min(Math.max(requested, 3), 60);
}

function describeSource(source: ImageSource): string {
  if (source === 'provider') return 'your image model';
  if (source === 'keyless') return 'the keyless image service';
  return 'procedural art (no image model reachable)';
}

function footerFor(toolName: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${toolName} · Open Creator AI · ${stamp}`;
}

export const RENDERERS: Record<
  string,
  (input: RenderInput, ctx: RenderContext) => Promise<ProducedFile[]>
> = {
  async 'thumbnail-generator'(input, ctx) {
    const topic = topicFrom(input.prompt, input.title);
    const { width, height } = resolveDims(input, '16:9');
    const variants = Math.min(Math.max(Number(input.variants) || 3, 1), 6);
    const layouts: ('center' | 'lower' | 'left')[] = ['lower', 'left', 'center'];
    const styles = posterStyles(themeFor('thumbnail-generator'), width);
    const files: ProducedFile[] = [];
    let source: ImageSource = 'local';

    await ctx.report(10, 'Generating artwork…');
    for (let index = 0; index < variants; index += 1) {
      const layout = layouts[index % layouts.length];
      const artName = `art-${index + 1}.png`;
      const image = await ctx.makeImage({
        prompt: `${topic} — ${['cinematic scene', 'editorial photo', 'moody portrait lighting'][index % 3]}`,
        width,
        height,
        out: artName,
        style:
          'cinematic still, shallow depth of field, dramatic lighting, rich colour, no text, no watermark',
      });
      source = image.source;

      await ctx.report(15 + index * (60 / variants), `Composing headline ${index + 1}…`);
      const name = `thumbnail-${index + 1}-${layout}.png`;
      const cues = posterCues(
        layout,
        { kicker: 'Thumbnail', title: topic, footer: footerFor('Thumbnail Generator') },
        width,
        styles,
      );
      await overlayOnImage(ctx, {
        imagePath: artName,
        out: name,
        ass: {
          name: `${name}.ass`,
          content: assDocument({ width, height, styles, cues }),
        },
        scrim: layout === 'center' ? 'full' : 'bottom',
      });
      files.push({
        name,
        kind: 'image',
        width,
        height,
        note: `${layout} layout · art: ${image.source}`,
      });
    }

    const log = [
      '# Thumbnail prompt log',
      '',
      `**Topic:** ${topic}`,
      `**Aspect:** ${input.aspect ?? '16:9'} (${width}×${height})`,
      `**Variants:** ${variants}`,
      `**Art source:** ${describeSource(source)}`,
      '',
      '## Layouts',
      ...files.map((file, index) => `- ${index + 1}. \`${file.name}\` — ${file.note}`),
      '',
    ].join('\n');
    await writeFile(join(ctx.workDir, 'prompt-log.md'), log, 'utf8');
    files.push({ name: 'prompt-log.md', kind: 'text' });
    return files;
  },

  async 'image-generation'(input, ctx) {
    const prompt = (input.prompt || input.title).trim();
    const topic = topicFrom(input.prompt, input.title);
    const wide = DIMENSIONS['16:9'];
    const square = DIMENSIONS['1:1'];

    await ctx.report(15, 'Generating the cover art…');
    const landscape = await ctx.makeImage({
      prompt,
      width: wide.width,
      height: wide.height,
      out: 'cover-16x9.png',
    });

    await ctx.report(60, 'Generating the square cut…');
    const squareArt = await ctx.makeImage({
      prompt,
      width: square.width,
      height: square.height,
      out: 'cover-1x1.png',
      style: 'centred composition, square crop, no text, no watermark',
    });

    const log = [
      '# Image prompt log',
      '',
      `**Prompt:** ${prompt}`,
      `**Art source:** ${describeSource(landscape.source)}`,
      '',
      '| File | Size |',
      '| --- | --- |',
      `| cover-16x9.png | ${wide.width}×${wide.height} |`,
      `| cover-1x1.png | ${square.width}×${square.height} |`,
      '',
      squareArt.source !== landscape.source
        ? `_The square cut fell back to \`${squareArt.source}\`._`
        : '',
      '',
    ].join('\n');
    await writeFile(join(ctx.workDir, 'prompt-log.md'), log, 'utf8');

    ctx.note(
      landscape.source === 'provider'
        ? `Art generated with ${landscape.model ?? 'your image model'}.`
        : landscape.source === 'keyless'
          ? 'Art generated by the keyless image service. Add an image model in Settings for a style you control.'
          : 'Art rendered locally (no image model reachable). Add an image model in Settings for photo-real output.',
    );

    void topic;
    return [
      { name: 'cover-16x9.png', kind: 'image', width: wide.width, height: wide.height },
      { name: 'cover-1x1.png', kind: 'image', width: square.width, height: square.height },
      { name: 'prompt-log.md', kind: 'text' },
    ];
  },

  async 'video-generation'(input, ctx) {
    const topic = topicFrom(input.prompt, input.title);
    const { width, height } = resolveDims(input, '16:9');
    const duration = clampDuration(input, 8);
    const script = buildScriptFor(topic, duration);

    await ctx.report(15, 'Generating the backdrop…');
    const backdrop = await ctx.makeImage({
      prompt: `${topic} — establishing shot, cinematic`,
      width,
      height,
      out: 'backdrop.png',
    });
    await ctx.report(45, 'Rendering frames with ffmpeg…');
    await makeCaptionClip(ctx, 'video-generation', {
      out: 'clip.mp4',
      width,
      height,
      duration,
      cues: cuesFromScript(script),
      stage: 'Generated clip',
      title: topic,
      backdrop: backdrop.path,
    });
    await ctx.report(85, 'Muxing audio…');

    const cues = cuesFromScript(script);
    await writeFile(join(ctx.workDir, 'captions.srt'), toSrt(cues), 'utf8');
    await writeFile(join(ctx.workDir, 'captions.vtt'), toVtt(cues), 'utf8');

    ctx.note(
      'Clip rendered locally with kinetic typography; a video model can replace the source footage later.',
    );
    return [
      { name: 'clip.mp4', kind: 'video', width, height, durationSeconds: duration },
      { name: 'captions.srt', kind: 'subtitle' },
      { name: 'captions.vtt', kind: 'subtitle' },
    ];
  },

  async 'short-script'(input, ctx) {
    const topic = topicFrom(input.prompt, input.title);
    const duration = clampDuration(input, 24);
    const script = buildShortScript(topic, duration);
    const { width, height } = resolveDims(input, '9:16');

    await ctx.report(25, 'Writing the hook and beats…');
    const markdown = [
      `# ${script.title}`,
      '',
      `**Platform:** short form · **Target length:** ${duration}s`,
      '',
      '## Script',
      '',
      ...script.beats.map(
        (beat) =>
          `### ${beat.label} · ${beat.start.toFixed(1)}s → ${beat.end.toFixed(1)}s\n\n${beat.text}\n`,
      ),
      '## Shot list',
      '',
      '- Close-up, eye line to camera, hook delivered fast.',
      '- B-roll of the work in progress behind beats 2–4.',
      '- End card with the CTA on screen while you say it.',
      '',
      '## Caption ideas',
      '',
      ...script.captions.slice(0, 5).map((caption) => `- ${caption}`),
      '',
    ].join('\n');
    await writeFile(join(ctx.workDir, 'script.md'), markdown, 'utf8');

    await ctx.report(45, 'Generating the teaser backdrop…');
    const backdrop = await ctx.makeImage({
      prompt: `${topic} — vertical social video still`,
      width,
      height,
      out: 'backdrop.png',
    });

    await ctx.report(60, 'Cutting the vertical teaser…');
    const cues = cuesFromScript(script);
    await makeCaptionClip(ctx, 'short-script', {
      out: 'teaser-vertical.mp4',
      width,
      height,
      duration: Math.min(duration, 12),
      cues: cues.map((cue) => ({
        ...cue,
        end: Math.min(cue.end, 12),
      })),
      stage: script.title,
      title: script.hook,
      backdrop: backdrop.path,
    });
    await writeFile(join(ctx.workDir, 'script.srt'), toSrt(cues), 'utf8');
    ctx.note(`Teaser backdrop: ${describeSource(backdrop.source)}.`);

    return [
      { name: 'script.md', kind: 'text' },
      {
        name: 'teaser-vertical.mp4',
        kind: 'video',
        width,
        height,
        durationSeconds: Math.min(duration, 12),
      },
      { name: 'script.srt', kind: 'subtitle' },
    ];
  },

  async 'stick-figure'(input, ctx) {
    const topic = topicFrom(input.prompt || input.sourceUrl || '', input.title);
    const duration = clampDuration(input, 10);
    const script = buildShortScript(topic, duration);
    const { width, height } = resolveDims(input, '16:9');

    await ctx.report(25, 'Storyboarding the beats…');
    await makeStickFigureClip(ctx, { out: 'animation.mp4', width, height, duration, script });

    await ctx.report(80, 'Exporting the storyboard frames…');
    const files: ProducedFile[] = [
      { name: 'animation.mp4', kind: 'video', width, height, durationSeconds: duration },
    ];
    const poses: ('idle' | 'wave' | 'point')[] = ['wave', 'point', 'idle'];
    for (const [index, pose] of poses.entries()) {
      const beat = script.beats[index] ?? script.beats[0];
      const styles = captionStyles(themeFor('stick-figure'), width, height);
      const figureStyle: AssStyle = {
        name: 'Figure',
        font: FONT_STACK,
        size: 100,
        color: '#ffffff',
        outlineColor: '#ffffff',
        bold: true,
        outline: 9,
        alignment: 5,
        marginV: 0,
      };
      const name = `storyboard-${index + 1}.png`;
      await renderPoster(ctx, themeFor('stick-figure'), {
        out: name,
        width,
        height,
        ass: {
          name: `${name}.ass`,
          content: assDocument({
            width,
            height,
            styles: [...styles, figureStyle],
            cues: [
              {
                start: 0,
                end: 10,
                text: clean(script.title).toUpperCase(),
                style: 'Stage',
              },
              {
                start: 0,
                end: 10,
                text: `{\\p1}${stickFigure(pose)}{\\p0}`,
                style: 'Figure',
                tags: `{\\pos(${Math.round(width * 0.5)},${Math.round(height * 0.44)})\\fscx${Math.round(
                  (height * 0.32 * 100) / FIGURE_BOX.height,
                )}\\fscy${Math.round((height * 0.32 * 100) / FIGURE_BOX.height)}}`,
              },
              {
                start: 0,
                end: 10,
                text: wrap(beat.text, Math.round(width / 24)),
                style: 'Caption',
              },
            ],
          }),
        },
      });
      files.push({ name, kind: 'image', width, height, note: beat.label });
    }

    await writeFile(
      join(ctx.workDir, 'narration.md'),
      [
        `# ${script.title}`,
        '',
        '## Narration',
        '',
        ...script.beats.map((beat) => `- **${beat.label}** — ${beat.text}`),
        '',
      ].join('\n'),
      'utf8',
    );
    files.push({ name: 'narration.md', kind: 'text' });
    ctx.note('Silent animation rendered — connect a TTS provider to add the voice track.');
    return files;
  },

  async 'subtitle-studio'(input, ctx) {
    const text = (input.sourceUrl?.trim() || input.prompt || input.title).trim();
    const cues = cuesFromText(text, 3);
    await ctx.report(25, 'Timing the captions…');
    await writeFile(join(ctx.workDir, 'captions.srt'), toSrt(cues), 'utf8');
    await writeFile(join(ctx.workDir, 'captions.vtt'), toVtt(cues), 'utf8');

    const { width, height } = resolveDims(input, '16:9');
    const duration = Math.min(Math.max(cues.at(-1)?.end ?? 6, 3), 30);
    await ctx.report(60, 'Burning the captions into a preview clip…');
    await makeCaptionClip(ctx, 'subtitle-studio', {
      out: 'captioned-preview.mp4',
      width,
      height,
      duration,
      cues,
      stage: 'Caption preview',
    });

    const files: ProducedFile[] = [
      { name: 'captions.srt', kind: 'subtitle' },
      { name: 'captions.vtt', kind: 'subtitle' },
      { name: 'captioned-preview.mp4', kind: 'video', width, height, durationSeconds: duration },
    ];

    if (input.language) {
      ctx.note(
        `Captions are in the source language. Automatic translation to ${input.language} needs a text model — add one in Settings.`,
      );
    }
    return files;
  },

  async 'article-writer'(input, ctx) {
    const topic = topicFrom(input.prompt, input.title);
    await ctx.report(30, 'Outlining…');
    const article = buildArticle(topic);
    await ctx.report(60, 'Drafting and exporting…');
    await writeFile(join(ctx.workDir, 'article.md'), article.markdown, 'utf8');

    const html = [
      '<!doctype html>',
      '<html lang="en"><head><meta charset="utf-8">',
      `<meta name="viewport" content="width=device-width,initial-scale=1">`,
      `<title>${article.title}</title>`,
      '<style>body{max-width:44rem;margin:3rem auto;padding:0 1.2rem;font:16px/1.7 system-ui,sans-serif;color:#16161d}h1{line-height:1.2}h2{margin-top:2.2rem}blockquote{border-left:3px solid #7c5cff;margin:1.5rem 0;padding-left:1rem;color:#555}</style>',
      '</head><body>',
      markdownToHtml(article.markdown),
      '</body></html>',
    ].join('\n');
    await writeFile(join(ctx.workDir, 'article.html'), html, 'utf8');

    return [
      { name: 'article.md', kind: 'text' },
      { name: 'article.html', kind: 'document' },
    ];
  },

  async 'workflow-planner'(input, ctx) {
    const goal = topicFrom(input.prompt, input.title);
    await ctx.report(40, 'Mapping the steps to tools…');
    const plan = buildPlan(
      goal,
      TOOLS.map((tool) => ({ id: tool.id, name: tool.name })),
    );
    await writeFile(join(ctx.workDir, 'plan.md'), plan.markdown, 'utf8');
    return [{ name: 'plan.md', kind: 'text' }];
  },
};

function buildScriptFor(topic: string, duration: number): ShortScript {
  // Imported lazily above in the tools that need it; this keeps the module graph
  // flat for the bundler used by the web tests.
  const beats = [
    { label: 'Open', text: topic, start: 0, end: duration * 0.3 },
    {
      label: 'Middle',
      text: 'One clear input, one clear output — everything else is optional.',
      start: duration * 0.3,
      end: duration * 0.68,
    },
    {
      label: 'Close',
      text: 'Ship the smallest version today, then iterate in public.',
      start: duration * 0.68,
      end: duration,
    },
  ];
  return {
    title: topic,
    hook: topic,
    beats,
    cta: 'Follow for the next one.',
    captions: beats.flatMap((beat) => chunkSentence(beat.text)),
  };
}

/** Minimal markdown → HTML for the article export (no dependency, escaped). */
function markdownToHtml(markdown: string): string {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (value: string) =>
    escape(value)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\s)_([^_]+)_/g, '$1<em>$2</em>');

  const lines = markdown.split('\n');
  const out: string[] = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      out.push('</ul>');
      listOpen = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      closeList();
      continue;
    }
    if (/^#\s/.test(line)) {
      closeList();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (/^##\s/.test(line)) {
      closeList();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (/^###\s/.test(line)) {
      closeList();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (/^>\s?/.test(line)) {
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
    } else if (/^[-*]\s/.test(line)) {
      if (!listOpen) {
        out.push('<ul>');
        listOpen = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s/, ''))}</li>`);
    } else if (/^---+$/.test(line)) {
      closeList();
      out.push('<hr>');
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}
