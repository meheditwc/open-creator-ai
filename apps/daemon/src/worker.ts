import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { Artifact, Run } from '@open-creator/shared';
import { getTool } from '@open-creator/shared';
import {
  type Context,
  buildArticle,
  buildCalendar,
  buildCaptions,
  buildChannelBlueprint,
  buildKeywordPlan,
  buildNicheReport,
  buildRoadmap,
  buildSeoPack,
  buildShortsScript,
  buildThumbnailBrief,
  buildUploadChecklist,
  buildVideoScript,
  topicFrom,
} from './youtube.ts';
import { logger } from './logger.ts';

/**
 * The run worker.
 *
 * A run turns the creator's answers into documents. Nothing here needs ffmpeg,
 * a model or a network call: the generator writes real, editable files into
 * `dataDir/artifacts/<runId>/`, and the daemon serves them back.
 */

export interface WorkerDeps {
  dataDir: string;
  updateRun: (runId: string, patch: Partial<Run>) => Promise<void>;
}

export const MIME: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.srt': 'application/x-subrip; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
};

export function mimeFor(name: string): string {
  return MIME[extname(name).toLowerCase()] ?? 'application/octet-stream';
}

export function artifactsDir(dataDir: string): string {
  return join(dataDir, 'artifacts');
}

interface Document {
  name: string;
  kind: Artifact['kind'];
  content: string;
  note?: string;
}

type Generator = (context: Context, fields: Record<string, string>) => Document[];

const GENERATORS: Record<string, Generator> = {
  'niche-finder': (context) => {
    const report = buildNicheReport(context);
    return [
      { name: 'niche-report.md', kind: 'text', content: report.markdown },
      { name: 'niches.csv', kind: 'data', content: report.table },
    ];
  },

  'channel-blueprint': (context, fields) => {
    const blueprint = buildChannelBlueprint(context, fields.channelName ?? '');
    return [
      { name: 'channel-blueprint.md', kind: 'text', content: blueprint.markdown },
      { name: 'channel-copy.json', kind: 'data', content: blueprint.json },
    ];
  },

  'keyword-research': (context, fields) => {
    const plan = buildKeywordPlan(context, fields.keywords ?? '');
    return [
      { name: 'keywords.csv', kind: 'data', content: plan.table },
      { name: 'keyword-plan.md', kind: 'text', content: plan.markdown },
    ];
  },

  'video-script': (context, fields) => {
    const script = buildVideoScript(context, fields.length ?? '8 minutes');
    return [
      { name: 'script.md', kind: 'text', content: script.markdown },
      { name: 'shot-list.csv', kind: 'data', content: script.shotList },
      { name: 'captions.srt', kind: 'subtitle', content: toSrtFile(script.captions) },
    ];
  },

  'shorts-script': (context, fields) => {
    const script = buildShortsScript(context, fields.length ?? '30 seconds');
    return [
      { name: 'shorts-script.md', kind: 'text', content: script.markdown },
      {
        name: 'captions.srt',
        kind: 'subtitle',
        content: toSrtFile(script.captions),
      },
    ];
  },

  'youtube-seo': (context, fields) => {
    const pack = buildSeoPack(context, fields.keywords ?? '');
    return [
      { name: 'seo-pack.md', kind: 'text', content: pack.markdown },
      { name: 'metadata.json', kind: 'data', content: pack.json },
    ];
  },

  'thumbnail-brief': (context, fields) => {
    const brief = buildThumbnailBrief(context, fields.tone ?? 'Curious');
    return [
      { name: 'thumbnail-brief.md', kind: 'text', content: brief.markdown },
      { name: 'overlay-text.txt', kind: 'text', content: brief.overlay },
    ];
  },

  captions: (context, fields) => {
    const pack = buildCaptions(
      fields.script || context.topic,
      Number.parseInt(fields.length ?? '3', 10) || 3,
    );
    return [
      { name: 'captions.srt', kind: 'subtitle', content: pack.srt, note: `${pack.cueCount} cues` },
      { name: 'captions.vtt', kind: 'subtitle', content: pack.vtt },
      { name: 'chapters.md', kind: 'text', content: pack.chapters },
    ];
  },

  'upload-checklist': (context) => {
    const checklist = buildUploadChecklist(context);
    return [
      { name: 'upload-checklist.md', kind: 'text', content: checklist.markdown },
      { name: 'checklist.json', kind: 'data', content: checklist.json },
    ];
  },

  'content-calendar': (context, fields) => {
    const calendar = buildCalendar(context, fields.length ?? '2');
    return [
      { name: 'calendar-30-days.csv', kind: 'data', content: calendar.table },
      { name: 'calendar-plan.md', kind: 'text', content: calendar.markdown },
    ];
  },

  'channel-roadmap': (context, fields) => {
    const roadmap = buildRoadmap(context, fields.length ?? '5 hours', fields.niche ?? '');
    return [{ name: 'roadmap.md', kind: 'text', content: roadmap }];
  },

  'article-writer': (context) => {
    const article = buildArticle(context);
    return [
      { name: 'article.md', kind: 'text', content: article.markdown },
      { name: 'article.html', kind: 'document', content: article.html },
    ];
  },
};

function toSrtFile(cues: { start: number; end: number; text: string }[]): string {
  const stamp = (seconds: number) => {
    const safe = Math.max(0, seconds);
    const pad = (value: number) => String(Math.floor(value)).padStart(2, '0');
    const ms = Math.round((safe % 1) * 1000);
    return `${pad(safe / 3600)}:${pad((safe % 3600) / 60)}:${pad(safe % 60)},${String(ms).padStart(3, '0')}`;
  };
  return `${cues
    .map((cue, index) => `${index + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`)
    .join('\n')}\n`;
}

/** Small concurrency gate: documents are cheap, but keep the loop predictable. */
export class RunQueue {
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

function contextFrom(run: Run): { context: Context; fields: Record<string, string> } {
  const fields = run.input?.fields ?? {};
  const topic = topicFrom(run.input?.prompt?.trim() || run.title, run.title);
  return {
    fields,
    context: {
      topic,
      audience: fields.audience?.trim() ?? '',
      market: fields.market?.trim() || 'English',
      tone: fields.tone?.trim() || 'Friendly teacher',
      notes: fields.notes?.trim() ?? '',
    },
  };
}

export async function executeRun(run: Run, deps: WorkerDeps): Promise<void> {
  const tool = getTool(run.tool);
  if (!tool) {
    await deps.updateRun(run.id, {
      status: 'failed',
      progress: 100,
      message: 'Unknown tool.',
      error: `Unknown tool: ${run.tool}`,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  const generator = GENERATORS[run.tool];
  if (!generator) {
    await deps.updateRun(run.id, {
      status: 'failed',
      progress: 100,
      message: 'This tool has no generator yet.',
      error: `No generator for ${run.tool}`,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  const workDir = join(artifactsDir(deps.dataDir), run.id);
  await mkdir(workDir, { recursive: true });

  const { context, fields } = contextFrom(run);
  const steps = tool.pipeline;

  const report = async (progress: number, message: string) => {
    await deps.updateRun(run.id, {
      status: 'running',
      progress: Math.min(Math.max(Math.round(progress), 1), 99),
      message,
      updatedAt: new Date().toISOString(),
    });
  };

  try {
    await report(10, `Starting ${tool.name}…`);

    // Walk the tool's own pipeline so the UI shows the real stages.
    const span = 70 / Math.max(steps.length, 1);
    for (const [index, step] of steps.entries()) {
      await report(10 + span * index, `${step}…`);
    }

    const documents = generator(context, fields);
    if (!documents.length) throw new Error('The generator produced no documents.');

    const artifacts: Artifact[] = [];
    for (const document of documents) {
      const path = join(workDir, document.name);
      await writeFile(path, document.content, 'utf8');
      const info = await stat(path);
      artifacts.push({
        id: `${run.id}_${document.name}`,
        name: document.name,
        kind: document.kind,
        mime: mimeFor(document.name),
        bytes: info.size,
        url: `/api/artifacts/${run.id}/${encodeURIComponent(document.name)}`,
        note: document.note,
        createdAt: new Date().toISOString(),
      });
    }

    const notes: string[] = [];
    notes.push(
      'Generated locally from your answers — edit the files in your own voice before publishing.',
    );
    if (!fields.audience) notes.push('Add an audience next time; the copy gets sharper.');

    await deps.updateRun(run.id, {
      status: 'completed',
      progress: 100,
      message: `${artifacts.length} file${artifacts.length === 1 ? '' : 's'} ready — ${artifacts
        .map((artifact) => artifact.name)
        .join(', ')}`,
      artifacts,
      notes,
      updatedAt: new Date().toISOString(),
    });
    logger.success(`run ${run.id}: ${artifacts.length} document(s) written`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    logger.warn(`run ${run.id} failed: ${message}`);
    await deps.updateRun(run.id, {
      status: 'failed',
      progress: 100,
      message: 'The run failed — see the details below.',
      error: message,
      notes: [],
      updatedAt: new Date().toISOString(),
    });
  }
}
