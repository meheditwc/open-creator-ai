import { homedir } from 'node:os';
import { resolve } from 'node:path';

export interface AppConfig {
  host: string;
  port: number;
  dataDir: string;
  version: string;
  /** Comma separated list of allowed browser origins. `*` allows any. */
  corsOrigins: string[];
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
    version: '0.2.0',
    corsOrigins: env('OPENCREATOR_CORS', '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

export function defaultDataDir(): string {
  return resolve(homedir(), '.open-creator-ai');
}
