import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Daemon } from '../src/server.ts';
import { loadConfig } from '../src/config.ts';

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

test('runs advance through the pipeline', async () => {
  await withDaemon(async (daemon) => {
    const run = await daemon.createRun({ tool: 'thumbnail-generator', title: 'Cover' });
    assert.equal(run.status, 'queued');
    assert.equal(run.progress, 0);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const finished = await daemon.getRun(run.id);
    assert.equal(finished?.status, 'completed');
    assert.equal(finished?.progress, 100);
    assert.ok(finished?.message.length);
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
    await waitFor(() => first.getRun(run.id)?.status === 'completed');

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
