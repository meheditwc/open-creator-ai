import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AppConfig {
  host: string;
  port: number;
  dataDir: string;
  version: string;
  /** Comma separated list of allowed browser origins. `*` allows any. */
  corsOrigins: string[];
}

/** The daemon version always matches the repository/package version. */
function packageVersion(): string {
  try {
    const manifest = fileURLToPath(new URL('../../../package.json', import.meta.url));
    const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { version?: string };
    return parsed.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function env(key: string, fallback = ''): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

export function loadConfig(): AppConfig {
  const dataDir = resolve(env('OPENCREATOR_DATA_DIR', resolve(process.cwd(), '.runtime')));
  return {
    host: env('OPENCREATOR_HOST', '127.0.0.1'),
    port: Number.parseInt(env('PORT', '9861'), 10),
    dataDir,
    version: packageVersion(),
    corsOrigins: env('OPENCREATOR_CORS', '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

export function defaultDataDir(): string {
  return resolve(homedir(), '.open-creator-ai');
}
