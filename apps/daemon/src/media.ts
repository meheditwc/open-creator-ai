import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

/**
 * The ffmpeg layer.
 *
 * Everything the studio renders (thumbnails, clips, burned-in captions) goes
 * through here. We shell out to the `ffmpeg` binary instead of pulling in a
 * native node binding: no compiler at install time, one process per render and
 * the exact same output a creator would get from their own terminal.
 */

export interface BinaryInfo {
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

const DEFAULT_CANDIDATES = [
  process.env.FFMPEG_PATH,
  'ffmpeg',
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/opt/homebrew/bin/ffmpeg',
  // Optional bundled binary (`npm run setup:media`), kept out of git.
  new URL('../.bin/ffmpeg', import.meta.url).pathname,
  '/tmp/oc-bin/ffmpeg',
].filter((candidate): candidate is string => Boolean(candidate));

let cachedFfmpeg: BinaryInfo | null = null;

async function isExecutable(path: string): Promise<boolean> {
  if (!path.includes('/')) return true; // resolved through PATH by spawn
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Run a command, buffering its output. Rejects on a non-zero exit code. */
export function exec(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<CommandResult> {
  const { cwd, timeoutMs = 120_000 } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      if (!settled) {
        settled = true;
        reject(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)}s`));
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > 200_000) stdout = stdout.slice(-100_000);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(
        error.code === 'ENOENT'
          ? Object.assign(new Error(`${command} was not found`), { code: 'ENOENT' })
          : error,
      );
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) resolve({ stdout, stderr });
      else {
        const tail = stderr.trim().split('\n').slice(-6).join('\n');
        reject(new Error(`${command} exited with code ${code}${tail ? `: ${tail}` : ''}`));
      }
    });
  });
}

/** Locate a working ffmpeg (cached; pass `true` to re-probe). */
export async function resolveFfmpeg(force = false): Promise<BinaryInfo> {
  if (cachedFfmpeg && !force) return cachedFfmpeg;

  let lastError = 'ffmpeg was not found on this machine';
  for (const candidate of DEFAULT_CANDIDATES) {
    if (!(await isExecutable(candidate))) continue;
    try {
      const { stdout } = await exec(candidate, ['-version'], { timeoutMs: 15_000 });
      const version = stdout.split('\n')[0]?.trim() ?? '';
      cachedFfmpeg = { available: true, path: candidate, version };
      return cachedFfmpeg;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  cachedFfmpeg = { available: false, error: lastError };
  return cachedFfmpeg;
}

/** Locate an optional binary (yt-dlp) without failing when it is missing. */
export async function resolveOptional(name: string): Promise<BinaryInfo> {
  const configured = process.env[`${name.toUpperCase().replace(/-/g, '_')}_PATH`];
  const candidates = [configured, name, `/usr/local/bin/${name}`, `/usr/bin/${name}`].filter(
    (candidate): candidate is string => Boolean(candidate),
  );

  let lastError = `${name} is not installed`;
  for (const candidate of candidates) {
    if (!(await isExecutable(candidate))) continue;
    try {
      const { stdout } = await exec(candidate, ['--version'], { timeoutMs: 10_000 });
      return { available: true, path: candidate, version: stdout.split('\n')[0]?.trim() };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  return { available: false, error: lastError };
}

/**
 * Run ffmpeg and throw a helpful, human-readable error when it fails.
 * `cwd` matters: renderers write their ASS files next to the output and pass
 * bare relative names, which avoids escaping hell in filter strings.
 */
export async function ffmpeg(
  binaryPath: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<CommandResult> {
  try {
    return await exec(binaryPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args], options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`ffmpeg failed: ${message.replace(/^ffmpeg exited with code \d+: ?/, '')}`, {
      cause: error,
    });
  }
}

export function resetMediaCache(): void {
  cachedFfmpeg = null;
}
