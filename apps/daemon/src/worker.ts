import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { AppSettings, Artifact, Run } from '@open-creator/shared';
import { getTool } from '@open-creator/shared';
import { RENDERERS, type ProducedFile, type RenderContext } from './renderers.ts';
import { resolveFfmpeg, resolveOptional } from './media.ts';
import { providerConfigured, synthesizeSpeech, translateText } from './provider.ts';
import {
  buildShortScript,
  cuesFromScript,
  cuesFromText,
  toSrt,
  toVtt,
  topicFrom,
} from './creative.ts';
import { logger } from './logger.ts';
import { exec } from './media.ts';

/**
 * The run worker.
 *
 * One run = one tool + the creator's input. The worker renders the deliverables
 * into `dataDir/artifacts/<runId>`, records every file as an artifact and
 * reports progress as it goes. Runs are executed with a small concurrency limit
 * so two heavy ffmpeg jobs never starve the HTTP server.
 */

export interface WorkerDeps {
  dataDir: string;
  getSettings: () => Promise<AppSettings>;
  updateRun: (runId: string, patch: Partial<Run>) => Promise<void>;
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.srt': 'application/x-subrip',
  '.vtt': 'text/vtt',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
};

export function mimeFor(name: string): string {
  return MIME[extname(name).toLowerCase()] ?? 'application/octet-stream';
}

export function artifactsDir(dataDir: string): string {
  return join(dataDir, 'artifacts');
}

export interface QueueItem {
  runId: string;
}

export class RenderQueue {
  private readonly pending: string[] = [];
  private active = 0;
  private readonly concurrency: number;
  private readonly handler: (runId: string) => Promise<void>;

  constructor(concurrency: number, handler: (runId: string) => Promise<void>) {
    this.concurrency = concurrency;
    this.handler = handler;
  }

  enqueue(runId: string): void {
    this.pending.push(runId);
    this.pump();
  }

  get size(): number {
    return this.pending.length + this.active;
  }

  private pump(): void {
    while (this.active < this.concurrency && this.pending.length) {
      const runId = this.pending.shift();
      if (!runId) return;
      this.active += 1;
      void this.handler(runId)
        .catch((error) => logger.error(`run ${runId} crashed: ${String(error)}`))
        .finally(() => {
          this.active -= 1;
          this.pump();
        });
    }
  }
}

/** A failure that the creator can act on, shown verbatim in the studio. */
class SetupError extends Error {}

async function collectArtifacts(
  runId: string,
  workDir: string,
  files: ProducedFile[],
): Promise<Artifact[]> {
  const artifacts: Artifact[] = [];
  for (const file of files) {
    try {
      const info = await stat(join(workDir, file.name));
      artifacts.push({
        id: `${runId}_${file.name}`,
        name: file.name,
        kind: file.kind,
        mime: mimeFor(file.name),
        bytes: info.size,
        url: `/api/artifacts/${runId}/${encodeURIComponent(file.name)}`,
        width: file.width,
        height: file.height,
        durationSeconds: file.durationSeconds,
        note: file.note,
        createdAt: new Date().toISOString(),
      });
    } catch {
      logger.warn(`expected artifact ${file.name} was not written for run ${runId}`);
    }
  }
  return artifacts;
}

/** Execute a single run end to end. */
export async function executeRun(run: Run, deps: WorkerDeps): Promise<void> {
  const tool = getTool(run.tool);
  if (!tool) {
    await deps.updateRun(run.id, {
      status: 'failed',
      error: `Unknown tool: ${run.tool}`,
      message: 'That tool does not exist.',
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  const workDir = join(artifactsDir(deps.dataDir), run.id);
  await mkdir(workDir, { recursive: true });

  const notes: string[] = [];
  const report = async (progress: number, message: string) => {
    await deps.updateRun(run.id, {
      status: 'running',
      progress: Math.min(Math.max(Math.round(progress), 1), 99),
      message,
      updatedAt: new Date().toISOString(),
    });
  };

  await report(5, `Starting ${tool.name}…`);

  try {
    const settings = await deps.getSettings();
    const ffmpegInfo = await resolveFfmpeg();
    if (tool.engine !== 'external' && !ffmpegInfo.available) {
      throw new SetupError(
        'ffmpeg is not installed on this machine. Run `npm run setup:media` (or install ffmpeg) and start the run again.',
      );
    }

    const ctx: RenderContext = {
      ffmpegPath: ffmpegInfo.path ?? 'ffmpeg',
      workDir,
      report,
      note: (message) => notes.push(message),
    };

    const input = {
      prompt: run.input.prompt?.trim() || run.title,
      sourceUrl: run.input.sourceUrl?.trim(),
      language: run.input.language?.trim(),
      aspect: run.input.aspect,
      durationSeconds: run.input.durationSeconds,
      variants: run.input.variants,
      title: run.title,
    };

    let files: ProducedFile[] = [];

    switch (run.tool) {
      case 'voiceover':
        files = await runVoiceover(run, deps, settings, ctx, input);
        break;
      case 'video-translation':
        files = await runTranslation(run, deps, settings, ctx, input);
        break;
      case 'video-downloader':
        files = await runDownloader(run, ctx, input);
        break;
      default: {
        const renderer = RENDERERS[run.tool];
        if (!renderer) throw new SetupError(`${tool.name} has no renderer yet on this machine.`);
        files = await renderer(input, ctx);
      }
    }

    await report(95, 'Collecting artifacts…');
    const artifacts = await collectArtifacts(run.id, workDir, files);

    if (artifacts.length === 0) {
      throw new SetupError('The run finished without producing any file — check the logs.');
    }

    const summary = `${artifacts.length} file${artifacts.length === 1 ? '' : 's'} ready`;
    await deps.updateRun(run.id, {
      status: 'completed',
      progress: 100,
      message: `${summary} — ${artifacts
        .map((artifact) => artifact.name)
        .slice(0, 3)
        .join(', ')}`,
      artifacts,
      notes,
      updatedAt: new Date().toISOString(),
    });
    logger.success(`run ${run.id}: ${summary}`);
  } catch (error) {
    const message =
      error instanceof SetupError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unexpected render error';
    logger.warn(`run ${run.id} failed: ${message}`);
    await deps.updateRun(run.id, {
      status: 'failed',
      progress: 100,
      message: 'The run failed — see the details below.',
      error: message,
      notes,
      updatedAt: new Date().toISOString(),
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Provider / external tools                                                   */
/* -------------------------------------------------------------------------- */

async function runVoiceover(
  run: Run,
  deps: WorkerDeps,
  settings: AppSettings,
  ctx: RenderContext,
  input: { prompt: string; language?: string },
): Promise<ProducedFile[]> {
  const topic = topicFrom(input.prompt, run.title);
  const script = buildShortScript(topic, Number(run.input.durationSeconds) || 18);
  const cues = cuesFromScript(script);

  await writeFile(
    join(ctx.workDir, 'narration.md'),
    [
      `# ${script.title}`,
      '',
      ...script.beats.map(
        (beat) =>
          `**${beat.label}** (${beat.start.toFixed(1)}s → ${beat.end.toFixed(1)}s)\n${beat.text}\n`,
      ),
    ].join('\n'),
    'utf8',
  );
  await writeFile(join(ctx.workDir, 'captions.srt'), toSrt(cues), 'utf8');

  const files: ProducedFile[] = [
    { name: 'narration.md', kind: 'text' },
    { name: 'captions.srt', kind: 'subtitle' },
  ];

  if (!providerConfigured(settings.llm)) {
    ctx.note(
      'Script and timed captions are ready. The audio track needs a TTS provider — add a base URL + API key in Settings and run again.',
    );
    return files;
  }

  await ctx.report(45, 'Synthesizing the voice track…');
  const text = script.beats.map((beat) => beat.text).join(' ');
  await synthesizeSpeech(settings.llm, text, join(ctx.workDir, 'voiceover.mp3'), {
    language: input.language,
  });
  files.unshift({ name: 'voiceover.mp3', kind: 'audio' });

  const { resolveFfmpeg } = await import('./media.ts');
  const ffmpegInfo = await resolveFfmpeg();
  if (ffmpegInfo.available) {
    await ctx.report(70, 'Muxing the waveform video…');
    const { exec } = await import('./media.ts');
    try {
      await exec(
        ffmpegInfo.path ?? 'ffmpeg',
        [
          '-y',
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          'voiceover.mp3',
          '-f',
          'lavfi',
          '-i',
          'color=c=0x120c22:s=1280x320',
          '-shortest',
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '28',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          'voiceover.mp4',
        ],
        { cwd: ctx.workDir, timeoutMs: 180_000 },
      );
      files.push({ name: 'voiceover.mp4', kind: 'video', width: 1280, height: 320 });
    } catch {
      ctx.note('Audio is ready; muxing the MP4 preview failed, the mp3 is still available.');
    }
  }
  return files;
}

async function runTranslation(
  run: Run,
  deps: WorkerDeps,
  settings: AppSettings,
  ctx: RenderContext,
  input: { prompt: string; sourceUrl?: string; language?: string },
): Promise<ProducedFile[]> {
  const target = input.language || 'Spanish';
  const source = input.sourceUrl || input.prompt;
  const cues = cuesFromText(source, 3);

  await ctx.report(35, 'Timing the source captions…');
  await writeFile(join(ctx.workDir, 'source.srt'), toSrt(cues), 'utf8');

  const files: ProducedFile[] = [{ name: 'source.srt', kind: 'subtitle' }];

  if (!providerConfigured(settings.llm)) {
    await writeFile(
      join(ctx.workDir, 'translation-worksheet.md'),
      [
        `# Translation worksheet — ${target}`,
        '',
        'The timed source captions are ready. Translating them needs a text model.',
        '',
        '| # | Time | Source |',
        '| --- | --- | --- |',
        ...cues.map(
          (cue, index) =>
            `| ${index + 1} | ${cue.start.toFixed(1)}s–${cue.end.toFixed(1)}s | ${cue.text} |`,
        ),
        '',
      ].join('\n'),
      'utf8',
    );
    files.push({ name: 'translation-worksheet.md', kind: 'text' });
    ctx.note(
      `Captions are timed and ready. Add a text provider in Settings to translate them into ${target} and dub the voice track.`,
    );
    return files;
  }

  await ctx.report(55, `Translating into ${target}…`);
  const translated = await Promise.all(
    cues.map((cue) => translateText(settings.llm, cue.text, target)),
  );
  const translatedCues = cues.map((cue, index) => ({ ...cue, text: translated[index] }));
  await writeFile(join(ctx.workDir, 'translated.srt'), toSrt(translatedCues), 'utf8');
  await writeFile(join(ctx.workDir, 'translated.vtt'), toVtt(translatedCues), 'utf8');
  files.push(
    { name: 'translated.srt', kind: 'subtitle' },
    { name: 'translated.vtt', kind: 'subtitle' },
  );

  await ctx.report(80, 'Synthesizing the dub…');
  await synthesizeSpeech(
    settings.llm,
    translatedCues.map((cue) => cue.text).join(' '),
    join(ctx.workDir, 'dub.mp3'),
    { language: target },
  );
  files.push({ name: 'dub.mp3', kind: 'audio' });

  ctx.note('Video re-render with the dub needs the source file on this machine.');
  return files;
}

async function runDownloader(
  run: Run,
  ctx: RenderContext,
  input: { sourceUrl?: string },
): Promise<ProducedFile[]> {
  const ytDlp = await resolveOptional('yt-dlp');
  if (!ytDlp.available) {
    throw new SetupError(
      'yt-dlp is not installed. Install it (`pipx install yt-dlp`, or use the Docker image) and start the run again.',
    );
  }
  if (!input.sourceUrl) {
    throw new SetupError('Paste a video URL into the run before starting Video Downloader.');
  }

  await ctx.report(40, 'Resolving the URL…');
  await writeFile(
    join(ctx.workDir, 'download-request.json'),
    `${JSON.stringify({ url: input.sourceUrl, requestedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  );

  await ctx.report(60, 'Downloading…');
  await exec(
    ytDlp.path ?? 'yt-dlp',
    ['-f', 'bv*+ba/b', '--merge-output-format', 'mp4', '-o', 'source.%(ext)s', input.sourceUrl],
    { cwd: ctx.workDir, timeoutMs: 900_000 },
  );

  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(ctx.workDir);
  const video = entries.find((entry) => /^source\.(mp4|mkv|webm)$/.test(entry));
  if (!video) throw new SetupError('The download finished but no video file was found.');

  const files: ProducedFile[] = [
    { name: video, kind: 'video' },
    { name: 'download-request.json', kind: 'text' },
  ];
  void run;
  return files;
}
