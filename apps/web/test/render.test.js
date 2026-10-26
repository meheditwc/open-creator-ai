import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { build } from 'vite';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const webRoot = path.join(repoRoot, 'apps/web');
const outputDir = await mkdtemp(path.join(os.tmpdir(), 'open-creator-render-'));
let dom;
const originalConsoleError = console.error;
const errorMessages = [];

// Always remove the temporary bundle and restore Node globals, including when
// the assertion fails (for example, on an incompatible React pair).
after(async () => {
  console.error = originalConsoleError;
  dom?.window.close();
  await rm(outputDir, { recursive: true, force: true });
});

test('the real studio entry bundles and renders with one compatible React copy', async () => {
  const lockfile = JSON.parse(await readFile(path.join(repoRoot, 'package-lock.json'), 'utf8'));
  const lockedReact = Object.entries(lockfile.packages).filter(([location]) =>
    /(^|\/)node_modules\/react$/.test(location),
  );
  const lockfileReactCount = lockedReact.length;
  const lockfileReactVersions = new Set(lockedReact.map(([, info]) => info.version));

  const npmLs = spawnSync('npm', ['ls', 'react', '--all', '--parseable'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const tree = npmLs.stdout.trim().split('\n').filter(Boolean);

  await build({
    configFile: path.join(webRoot, 'vite.config.ts'),
    root: webRoot,
    logLevel: 'warn',
    build: {
      ssr: 'src/main.tsx',
      outDir: outputDir,
      emptyOutDir: true,
      rollupOptions: {
        output: { format: 'es', entryFileNames: 'main.mjs' },
      },
    },
    ssr: { noExternal: true },
  });

  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: dom.window.navigator,
  });
  console.error = (...args) => {
    errorMessages.push(
      args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' '),
    );
  };
  dom.window.addEventListener('error', (event) => {
    errorMessages.push(event.error?.message ?? event.message);
  });

  try {
    await import(pathToFileURL(path.join(outputDir, 'main.mjs')).href);
    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (error) {
    errorMessages.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
    else delete globalThis.navigator;
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }

  const markup = dom.window.document.querySelector('#root').innerHTML;

  // The dashboard is the channel journey now, not a media gallery.
  for (const expected of [
    'Channel banano theke',
    'channel journey',
    'Niche Finder',
    'Video Script',
    'niche-report.md',
  ]) {
    assert.ok(markup.includes(expected), `the dashboard renders "${expected}"`);
  }
  for (const gone of ['Thumbnail Generator', 'Image Generation', 'Video Downloader']) {
    assert.ok(!markup.includes(gone), `the dashboard no longer advertises "${gone}"`);
  }

  assert.doesNotMatch(
    errorMessages.join('\n'),
    /Incompatible React versions|older version of React/i,
    `React reported a runtime compatibility error:\n${errorMessages.join('\n')}`,
  );
  assert.ok(
    dom.window.document.querySelector('#root').innerHTML.trim().length > 0,
    'the app must render actual markup inside #root',
  );
  assert.equal(lockfileReactCount, 1, 'package-lock.json must contain exactly one React package');
  assert.equal(lockfileReactVersions.size, 1, 'package-lock.json must not mix React versions');
  assert.equal(npmLs.status, 0, `npm reports an invalid React dependency tree:\n${npmLs.stderr}`);
  assert.equal(
    tree.length,
    1,
    `npm dependency tree must contain one React copy, found:\n${tree.join('\n')}`,
  );
});
