import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Daemon } from '../src/server.ts';
import { loadConfig } from '../src/config.ts';
import { TOOLS, getTool } from '@open-creator/shared';

const dataDir = join(tmpdir(), `open-creator-ai-test-${Date.now()}`);

const config = {
  ...loadConfig(),
  port: 0,
  dataDir,
  corsOrigins: ['*'],
};

async function withDaemon<T>(fn: (daemon: Daemon) => Promise<T>): Promise<T> {
  const daemon = new Daemon(config);
  try {
    return await fn(daemon);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

async function waitForRun(daemon: Daemon, runId: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let run = daemon.getRun(runId);
  while (run && run.status !== 'completed' && run.status !== 'failed') {
    if (Date.now() > deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
    run = daemon.getRun(runId);
  }
  assert.ok(run, 'the run still exists');
  return run;
}

test('health reports a healthy daemon', async () => {
  await withDaemon(async (daemon) => {
    const health = (await daemon.health()) as {
      status: string;
      version: string;
      projects: number;
      runs: number;
      llm: { reachable: boolean; models: string[] };
    };

    assert.equal(health.status, 'ok');
    assert.equal(typeof health.version, 'string');
    assert.equal(health.projects, 0);
    assert.equal(health.runs, 0);
    assert.equal(typeof health.llm.reachable, 'boolean');
    assert.ok(Array.isArray(health.llm.models));
  });
});

test('projects can be created, listed, updated and deleted', async () => {
  await withDaemon(async (daemon) => {
    const project = await daemon.createProject({
      name: 'Launch teaser',
      description: 'October release',
    });

    assert.equal(project.name, 'Launch teaser');
    assert.ok(project.id.startsWith('prj_'));

    const listed = (await daemon.listProjects()) as { items: unknown[]; total: number };
    assert.equal(listed.total, 1);

    const updated = await daemon.updateProject(project.id, { name: 'Launch teaser v2' });
    assert.equal(updated.name, 'Launch teaser v2');

    const removed = await daemon.deleteProject(project.id);
    assert.equal(removed.deleted, true);

    const after = (await daemon.listProjects()) as { total: number };
    assert.equal(after.total, 0);
  });
});

test('a project name is required', async () => {
  await withDaemon(async (daemon) => {
    await assert.rejects(() => daemon.createProject({ name: '   ' }), /name is required/i);
  });
});

test('unknown tools are rejected', async () => {
  await withDaemon(async (daemon) => {
    await assert.rejects(() => daemon.createRun({ tool: 'not-a-tool' }), /unknown tool/i);
  });
});

test('the tool catalogue covers the whole channel journey', () => {
  assert.equal(TOOLS.length, 12);
  for (const stage of ['start', 'plan', 'write', 'publish', 'grow']) {
    assert.ok(
      TOOLS.some((tool) => tool.stage === stage),
      `stage ${stage} has at least one tool`,
    );
  }
  for (const tool of TOOLS) {
    assert.ok(tool.fields.length > 0, `${tool.id} declares fields`);
    assert.ok(tool.deliverables.length > 0, `${tool.id} declares deliverables`);
    for (const file of tool.deliverables) {
      assert.match(
        file,
        /\.(md|csv|json|srt|vtt|txt|html)$/,
        `${tool.id} → ${file} is a real file`,
      );
    }
  }
  // Everything ships without a model, an API key or a binary.
  assert.ok(TOOLS.every((tool) => tool.status === 'stable'));
  assert.equal(getTool('video-generation'), undefined, 'no image/video generation tools remain');
});

/**
 * The acceptance test for the whole product: every tool, run for real, must
 * write the exact files it advertises, with content that is not a stub.
 */
test('every tool writes its declared deliverables', async () => {
  await withDaemon(async (daemon) => {
    const fields = {
      audience: 'beginner video editors in Bangladesh',
      market: 'Bangla',
      tone: 'Direct and no-fluff',
      length: '8 minutes',
      keywords: 'edit videos on phone, capcut tutorial',
      channelName: 'Cut Faster',
      script: 'This is my opening line. Here is the second sentence. And a third one follows.',
      notes: 'mention the free checklist',
    };

    for (const tool of TOOLS) {
      const topic = {
        'niche-finder': 'phone video editing, cooking for one, freelancing',
        'channel-blueprint': 'phone video editing for beginners',
        'keyword-research': 'edit videos on phone',
        'content-calendar': 'phone video editing',
        'video-script': 'edit a week of content in one afternoon',
        'shorts-script': 'stop editing with ten layers',
        'youtube-seo': 'how to edit videos faster on a phone',
        'thumbnail-brief': 'I edited a video in 20 minutes',
        captions: 'Caption this script please',
        'upload-checklist': 'my first edit on a phone',
        'channel-roadmap': 'a thousand subscribers in 90 days',
        'article-writer': 'why my videos got better when I cut the intro',
      }[tool.id] as string;

      const run = await daemon.createRun({ tool: tool.id, prompt: topic, fields });
      assert.equal(run.status, 'queued', `${tool.id} queued`);

      const finished = await waitForRun(daemon, run.id);
      assert.equal(finished.status, 'completed', `${tool.id}: ${finished.error ?? ''}`);
      assert.equal(finished.progress, 100);

      const names = (finished.artifacts ?? []).map((artifact) => artifact.name).sort();
      assert.deepEqual(names, [...tool.deliverables].sort(), `${tool.id} wrote its deliverables`);

      for (const artifact of finished.artifacts ?? []) {
        assert.ok(artifact.bytes > 40, `${tool.id}/${artifact.name} is not an empty file`);
        assert.match(artifact.url, new RegExp(`^/api/artifacts/${run.id}/`));
        const body = await readFile(join(dataDir, 'artifacts', run.id, artifact.name), 'utf8');
        assert.ok(body.trim().length > 0);
        assert.doesNotMatch(body, /lorem ipsum|TODO|placeholder/i, `${artifact.name} is real`);
      }
    }
  });
});

test('a script run produces a subtitled, shot-listed document', async () => {
  await withDaemon(async (daemon) => {
    const run = await daemon.createRun({
      tool: 'video-script',
      prompt: 'how I batch a month of videos in two days',
      fields: { audience: 'solo creators', length: '8 minutes', tone: 'Direct' },
    });
    const finished = await waitForRun(daemon, run.id);
    assert.equal(finished.status, 'completed');

    const script = (finished.artifacts ?? []).find((artifact) => artifact.name === 'script.md');
    assert.ok(script);
    const body = await readFile(join(dataDir, 'artifacts', run.id, 'script.md'), 'utf8');
    // A usable script has timed sections, hooks and a spoken word count.
    assert.match(body, /^# /m);
    assert.match(body, /### Hook · \d+:\d\d → \d+:\d\d/);
    assert.match(body, /spoken words/);
    assert.match(body, /CTA/i);

    const srt = await readFile(join(dataDir, 'artifacts', run.id, 'captions.srt'), 'utf8');
    assert.match(srt, /^1\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/m);
  });
});

test('generation is deterministic for the same input', async () => {
  await withDaemon(async (daemon) => {
    const input = {
      tool: 'youtube-seo',
      prompt: 'edit faster on a phone',
      fields: { keywords: 'phone editing', audience: 'beginners' },
    };
    const first = await waitForRun(daemon, (await daemon.createRun(input)).id);
    const second = await waitForRun(daemon, (await daemon.createRun(input)).id);

    const read = (runId: string) =>
      readFile(join(dataDir, 'artifacts', runId, 'seo-pack.md'), 'utf8');
    assert.equal(await read(first.id), await read(second.id));
  });
});

test('capabilities report every tool as ready without a provider', async () => {
  await withDaemon(async (daemon) => {
    const capabilities = await daemon.capabilities();
    assert.equal(Object.keys(capabilities.tools).length, TOOLS.length);
    for (const tool of TOOLS) {
      const entry = capabilities.tools[tool.id];
      assert.equal(entry.ready, true, `${tool.id} is ready`);
      assert.deepEqual(entry.missing, []);
    }
    assert.equal(capabilities.provider.configured, false);
  });
});

test('settings round-trip', async () => {
  await withDaemon(async (daemon) => {
    const updated = await daemon.updateSettings({
      llm: { baseUrl: 'http://localhost:9999/v1', apiKey: 'x', model: 'm', fastModel: 'm' },
    });
    assert.equal(updated.llm.baseUrl, 'http://localhost:9999/v1');

    const settings = await daemon.getSettings();
    assert.equal(settings.llm.apiKey, 'x');
  });
});

test('the agent answers with the offline planner when no provider is configured', async () => {
  await withDaemon(async (daemon) => {
    const response = await daemon.chat('write me a script for my next upload');
    assert.equal(response.source, 'local');
    assert.match(response.reply, /Video Script/i);
    assert.ok(response.suggestions && response.suggestions.length > 0);
  });
});

test('artifacts are served over HTTP with the right content type', async () => {
  const httpConfig = { ...loadConfig(), port: 0, dataDir, corsOrigins: ['*'] };
  const daemon = new Daemon(httpConfig);
  const server = createServer((request, response) => void daemon.handle(request, response));

  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;

    const run = await daemon.createRun({
      tool: 'captions',
      prompt: 'First line of the script. Second line of the script.',
      fields: { length: '3' },
    });
    const finished = await waitForRun(daemon, run.id);
    const srt = (finished.artifacts ?? []).find((artifact) => artifact.name === 'captions.srt');
    assert.ok(srt);

    const response = await fetch(`${base}${srt.url}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/x-subrip/);
    const body = await response.text();
    assert.match(body, /-->/, 'the SRT body is served');

    const download = await fetch(`${base}${srt.url}?download=1`);
    assert.match(
      download.headers.get('content-disposition') ?? '',
      /attachment; filename="captions.srt"/,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('projects and runs survive a daemon restart', async () => {
  const restartDir = join(tmpdir(), `open-creator-ai-restart-${Date.now()}`);
  const restartConfig = { ...loadConfig(), port: 0, dataDir: restartDir, corsOrigins: ['*'] };

  try {
    const first = new Daemon(restartConfig);
    const project = await first.createProject({ name: 'Survives restarts' });
    const run = await first.createRun({
      tool: 'keyword-research',
      projectId: project.id,
      prompt: 'edit videos on phone',
    });
    await waitForRun(first, run.id);

    // A second instance on the same data directory is exactly what a restart
    // does: the workspace must be read back from disk, not started empty.
    const second = new Daemon(restartConfig);

    const projects = (await second.listProjects()) as { items: { name: string }[]; total: number };
    assert.equal(projects.total, 1);
    assert.equal(projects.items[0].name, 'Survives restarts');

    const runs = (await second.listRuns()) as {
      items: { status: string; artifacts: unknown[] }[];
      total: number;
    };
    assert.equal(runs.total, 1);
    assert.equal(runs.items[0].status, 'completed');
    assert.equal(runs.items[0].artifacts.length, 2);

    const health = (await second.health()) as { projects: number; runs: number };
    assert.equal(health.projects, 1);
    assert.equal(health.runs, 1);
  } finally {
    await rm(restartDir, { recursive: true, force: true });
  }
});

test('a run interrupted by a restart is reported as failed, not left running', async () => {
  const interruptedDir = join(tmpdir(), `open-creator-ai-interrupted-${Date.now()}`);
  const interruptedConfig = {
    ...loadConfig(),
    port: 0,
    dataDir: interruptedDir,
    corsOrigins: ['*'],
  };

  try {
    const first = new Daemon(interruptedConfig);
    const run = await first.createRun({ tool: 'channel-roadmap', prompt: 'grow my channel' });

    // Simulate the crash: a run left mid-flight on disk.
    await first['runs'].put({ ...run, status: 'running', progress: 40 });

    const second = new Daemon(interruptedConfig);
    const settled = () => second.getRun(run.id)?.status === 'failed';
    const deadline = Date.now() + 5000;
    while (!settled() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(second.getRun(run.id)?.status, 'failed');
    assert.match(second.getRun(run.id)?.message ?? '', /restart/i);
  } finally {
    await rm(interruptedDir, { recursive: true, force: true });
  }
});

test('the reported version matches the package manifest', () => {
  const { version } = loadConfig();
  assert.match(version, /^\d+\.\d+\.\d+/);
  assert.equal(version, '0.4.0');
});
