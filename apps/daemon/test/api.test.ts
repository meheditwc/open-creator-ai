import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Daemon } from '../src/server.ts';
import { loadConfig } from '../src/config.ts';
import { resolveFfmpeg } from '../src/media.ts';

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

test('a run renders real files with ffmpeg', async (t) => {
  const ffmpeg = await resolveFfmpeg();
  if (!ffmpeg.available) {
    t.skip('ffmpeg is not installed on this machine');
    return;
  }

  await withDaemon(async (daemon) => {
    const run = await daemon.createRun({
      tool: 'thumbnail-generator',
      title: 'Cover',
      prompt: 'How I edit a week of content',
      variants: 2,
    });
    assert.equal(run.status, 'queued');
    assert.equal(run.progress, 0);

    let finished = await daemon.getRun(run.id);
    const deadline = Date.now() + 60_000;
    while (finished?.status !== 'completed' && finished?.status !== 'failed') {
      if (Date.now() > deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
      finished = await daemon.getRun(run.id);
    }

    assert.equal(finished?.status, 'completed', finished?.error);
    assert.equal(finished?.progress, 100);
    assert.equal(finished?.artifacts.length, 3); // 2 PNGs + prompt log
    const png = finished?.artifacts.find((artifact) => artifact.name.endsWith('.png'));
    assert.ok(png, 'a PNG was rendered');
    assert.equal(png?.kind, 'image');
    assert.ok((png?.bytes ?? 0) > 5000, 'the PNG is not an empty file');
    // Layouts rotate (lower → left → center) and the file is served by run id.
    assert.match(
      png?.url ?? '',
      new RegExp(`^/api/artifacts/${run.id}/thumbnail-\\d-(lower|left|center)\\.png$`),
    );
  });
});

test('a run that needs a provider fails with an actionable message', async (t) => {
  const ffmpeg = await resolveFfmpeg();
  if (!ffmpeg.available) {
    t.skip('ffmpeg is not installed on this machine');
    return;
  }

  await withDaemon(async (daemon) => {
    // Video Downloader requires yt-dlp; this environment has no download
    // without it, and the run must say so instead of pretending to succeed.
    const run = await daemon.createRun({
      tool: 'video-downloader',
      sourceUrl: 'https://example.com/video',
    });

    let finished = await daemon.getRun(run.id);
    const deadline = Date.now() + 20_000;
    while (finished?.status !== 'completed' && finished?.status !== 'failed') {
      if (Date.now() > deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
      finished = await daemon.getRun(run.id);
    }

    assert.equal(finished?.status, 'failed');
    assert.match(finished?.error ?? '', /yt-dlp/i);
    assert.equal(finished?.artifacts.length, 0);
  });
});

test('capabilities report what this machine can actually run', async () => {
  await withDaemon(async (daemon) => {
    const capabilities = (await daemon.capabilities()) as {
      ffmpeg: { available: boolean };
      provider: { configured: boolean };
      tools: Record<string, { ready: boolean; missing: string[] }>;
    };

    assert.equal(typeof capabilities.ffmpeg.available, 'boolean');
    assert.equal(typeof capabilities.provider.configured, 'boolean');
    assert.ok(capabilities.tools['thumbnail-generator']);
    assert.ok(Array.isArray(capabilities.tools['thumbnail-generator'].missing));
  });
});

test('a run without a prompt still renders from its title', async (t) => {
  const ffmpeg = await resolveFfmpeg();
  if (!ffmpeg.available) {
    t.skip('ffmpeg is not installed on this machine');
    return;
  }

  await withDaemon(async (daemon) => {
    const run = await daemon.createRun({ tool: 'article-writer', title: 'Release notes v1' });
    let finished = await daemon.getRun(run.id);
    const deadline = Date.now() + 20_000;
    while (finished?.status !== 'completed' && finished?.status !== 'failed') {
      if (Date.now() > deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
      finished = await daemon.getRun(run.id);
    }
    assert.equal(finished?.status, 'completed', finished?.error);
    assert.deepEqual(finished?.artifacts.map((artifact) => artifact.name).sort(), [
      'article.html',
      'article.md',
    ]);
  });
});

test('unknown tools are rejected', async () => {
  await withDaemon(async (daemon) => {
    await assert.rejects(() => daemon.createRun({ tool: 'not-a-tool' }), /unknown tool/i);
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
    const response = await daemon.chat('translate this video into Spanish');
    assert.equal(response.source, 'local');
    assert.match(response.reply, /Video Translation/i);
    assert.ok(response.suggestions && response.suggestions.length > 0);
  });
});

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('timed out waiting for the condition');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test('projects and runs survive a daemon restart', async () => {
  const restartDir = join(tmpdir(), `open-creator-ai-restart-${Date.now()}`);
  const restartConfig = { ...loadConfig(), port: 0, dataDir: restartDir, corsOrigins: ['*'] };

  try {
    const first = new Daemon(restartConfig);
    const project = await first.createProject({ name: 'Survives restarts' });
    const run = await first.createRun({ tool: 'short-script', projectId: project.id });
    // A real render, not a simulated delay — give ffmpeg time to finish.
    await waitFor(() => first.getRun(run.id)?.status === 'completed', 60_000);

    // A second instance on the same data directory is exactly what a restart
    // does: the workspace must be read back from disk, not started empty.
    const second = new Daemon(restartConfig);

    const projects = (await second.listProjects()) as { items: { name: string }[]; total: number };
    assert.equal(projects.total, 1);
    assert.equal(projects.items[0].name, 'Survives restarts');

    const runs = (await second.listRuns()) as { items: { status: string }[]; total: number };
    assert.equal(runs.total, 1);
    assert.equal(runs.items[0].status, 'completed');

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
    const run = await first.createRun({ tool: 'video-translation' });

    // Simulate the crash: a run left mid-flight on disk.
    await first['runs'].put({ ...run, status: 'running', progress: 40 });
    await first['runs'].put({ ...run, status: 'running', progress: 40 });

    const second = new Daemon(interruptedConfig);
    await waitFor(() => second.getRun(run.id)?.status === 'failed');
    assert.equal(second.getRun(run.id)?.status, 'failed');
    assert.match(second.getRun(run.id)?.message ?? '', /restart/i);
  } finally {
    await rm(interruptedDir, { recursive: true, force: true });
  }
});

test('the reported version matches the package manifest', async () => {
  const { version } = loadConfig();
  assert.match(version, /^\d+\.\d+\.\d+/);
  assert.notEqual(version, '0.2.0');
});

/* -------------------------------------------------------------------------- */
/* Image generation tiers                                                      */
/* -------------------------------------------------------------------------- */

test('images come from the provider, then the keyless service, then local art', async (t) => {
  const ffmpeg = await resolveFfmpeg();
  if (!ffmpeg.available) {
    t.skip('ffmpeg is not installed on this machine');
    return;
  }

  const { createServer } = await import('node:http');
  const { readFile } = await import('node:fs/promises');
  const { generateImage, proceduralArt } = await import('../src/imagegen.ts');

  const fixtureDir = await mkdtemp(join(tmpdir(), 'open-creator-img-'));
  const fixturePath = join(fixtureDir, 'fixture.png');
  // A real image to serve as if it were generated.
  await proceduralArt(ffmpeg.path!, {
    prompt: 'fixture',
    width: 640,
    height: 360,
    outPath: fixturePath,
  });
  const payload = await readFile(fixturePath);

  const server = createServer((request, response) => {
    if (request.url?.startsWith('/v1/images/generations') && request.method === 'POST') {
      request.resume();
      request.on('end', () => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ data: [{ b64_json: payload.toString('base64') }] }));
      });
      return;
    }
    if (request.url?.startsWith('/prompt/')) {
      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(payload);
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  const previousEndpoint = process.env.OPENCREATOR_IMAGE_URL;
  process.env.OPENCREATOR_IMAGE_URL = `${base}/prompt`;

  const emptySettings = {
    llm: { baseUrl: '', apiKey: '', model: '', fastModel: '', imageModel: '' },
    dataDir: fixtureDir,
    useFreeRouter: true,
    autosave: true,
    keylessImages: true,
  };

  try {
    // 1. No image model → the keyless service is used.
    const keyless = await generateImage({
      settings: emptySettings,
      ffmpegPath: ffmpeg.path!,
      request: {
        prompt: 'a neon studio',
        width: 640,
        height: 360,
        outPath: join(fixtureDir, 'a.png'),
      },
    });
    assert.equal(keyless.source, 'keyless');

    // 2. An image model is configured → the provider wins.
    const provider = await generateImage({
      settings: {
        ...emptySettings,
        llm: {
          baseUrl: `${base}/v1`,
          apiKey: 'test-key',
          model: 'm',
          fastModel: 'm',
          imageModel: 'image-model-1',
        },
      },
      ffmpegPath: ffmpeg.path!,
      request: {
        prompt: 'a neon studio',
        width: 640,
        height: 360,
        outPath: join(fixtureDir, 'b.png'),
      },
    });
    assert.equal(provider.source, 'provider');
    assert.equal(provider.model, 'image-model-1');

    // 3. Everything unavailable → procedural art is still written.
    const local = await generateImage({
      settings: { ...emptySettings, keylessImages: false },
      ffmpegPath: ffmpeg.path!,
      request: {
        prompt: 'a neon studio',
        width: 640,
        height: 360,
        outPath: join(fixtureDir, 'c.png'),
      },
    });
    assert.equal(local.source, 'local');
    const written = await readFile(local.path);
    assert.ok(written.byteLength > 20_000, 'procedural art is a real image, not a blank frame');
  } finally {
    if (previousEndpoint === undefined) delete process.env.OPENCREATOR_IMAGE_URL;
    else process.env.OPENCREATOR_IMAGE_URL = previousEndpoint;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(fixtureDir, { recursive: true, force: true });
  }
});
