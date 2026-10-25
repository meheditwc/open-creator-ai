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
