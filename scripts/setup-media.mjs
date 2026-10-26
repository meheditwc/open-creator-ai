#!/usr/bin/env node
/**
 * Install a local ffmpeg for the studio.
 *
 * The daemon shells out to `ffmpeg` for every render. If your machine already
 * has one on the PATH you do not need this script — it only exists so a fresh
 * clone can render without a system package manager or a compiler.
 *
 * Usage: npm run setup:media
 *
 * Order of attempts:
 *   1. an ffmpeg already on the PATH (nothing to do)
 *   2. `pip3 install imageio-ffmpeg` into .media/ and link the bundled binary
 *   3. a static build from the ffmpeg-static GitHub release, via curl or wget
 */

import { spawnSync } from 'node:child_process';
import { chmod, copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const binDir = join(root, 'apps/daemon/.bin');
const target = join(binDir, 'ffmpeg');
const mediaDir = join(root, '.media');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8', ...options });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function log(message) {
  console.log(`\u001b[36m›\u001b[0m ${message}`);
}

async function verify(path) {
  const result = run(path, ['-version'], { timeout: 20_000 });
  if (!result.ok) return null;
  return result.stdout.split('\n')[0]?.trim() ?? '';
}

async function existingOnPath() {
  for (const candidate of ['ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg']) {
    const version = await verify(candidate);
    if (version) return { path: candidate, version, system: true };
  }
  return null;
}

async function fromImageio() {
  if (!run('python3', ['--version']).ok && !run('pip3', ['--version']).ok) return null;
  log('installing imageio-ffmpeg into .media/…');
  const installed = run('pip3', [
    'install',
    '--quiet',
    '--target',
    mediaDir,
    '--upgrade',
    'imageio-ffmpeg',
  ]);
  if (!installed.ok) {
    console.warn(installed.stderr.trim().split('\n').slice(-2).join('\n'));
    return null;
  }

  const binaries = join(mediaDir, 'imageio_ffmpeg', 'binaries');
  const entries = await readdir(binaries).catch(() => []);
  const binary = entries.find((entry) => entry.startsWith('ffmpeg-'));
  if (!binary) return null;

  const source = join(binaries, binary);
  await chmod(source, 0o755);
  await mkdir(binDir, { recursive: true });
  await rm(target, { force: true });
  await copyFile(source, target);
  await chmod(target, 0o755);
  const version = await verify(target);
  // The download cache duplicates ~80 MB; the copy in .bin/ is what we keep.
  await rm(mediaDir, { recursive: true, force: true }).catch(() => undefined);
  return version;
}

async function fromGitHubRelease() {
  const urls = [
    'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64',
    'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-darwin-arm64',
    'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-darwin-x64',
  ];
  await mkdir(binDir, { recursive: true });

  for (const url of urls) {
    log(`trying ${url.split('/').pop()}…`);
    const downloaded = run('curl', ['-fsSL', '--max-time', '300', '-o', target, url]);
    if (!downloaded.ok) {
      const wget = run('wget', ['-q', '-O', target, url]);
      if (!wget.ok) continue;
    }
    await chmod(target, 0o755).catch(() => undefined);
    const version = await verify(target);
    if (version) return version;
    await rm(target, { force: true });
  }
  return null;
}

const found = await existingOnPath();
if (found) {
  log(`ffmpeg is already available: ${found.version}`);
  log(`path: ${found.path}`);
  process.exit(0);
}

log('no system ffmpeg found — fetching a static build');
let version = await fromImageio();
if (!version) version = await fromGitHubRelease();

if (!version) {
  console.error(
    [
      '',
      'Could not install ffmpeg automatically.',
      'Install it with your package manager and run this again:',
      '  macOS:  brew install ffmpeg',
      '  Debian: sudo apt install ffmpeg',
      '  Docker: docker build -t open-creator-ai .   (ships ffmpeg + yt-dlp)',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const size = (await stat(target)).size;
log(`installed: ${version}`);
log(`path: ${target} (${(size / 1024 / 1024).toFixed(1)} MB, git-ignored)`);
log('restart the daemon (`npm run dev`) and run any tool — files will render.');
