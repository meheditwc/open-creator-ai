import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * A tiny, durable JSON document store.
 *
 * Why not SQLite? Open Creator AI ships with **zero native dependencies**, so
 * `npm install` never needs a compiler and the daemon starts in milliseconds.
 * Every collection is one JSON file that is written atomically (write temp →
 * rename) so a crash can never leave a half-written file behind.
 */
export class JsonStore<T extends { id: string }> {
  private cache: Map<string, T> | null = null;
  private writing: Promise<void> = Promise.resolve();
  /** Single-flight guard so concurrent callers share one read. */
  private loading: Promise<void> | null = null;

  private readonly file: string;
  private readonly defaults: () => T[];

  constructor(file: string, defaults: () => T[]) {
    this.file = file;
    this.defaults = defaults;
  }

  private get path(): string {
    return this.file;
  }

  async load(): Promise<void> {
    if (this.cache) return;
    this.loading ??= this.read();
    await this.loading;
  }

  private async read(): Promise<void> {
    try {
      const raw = await readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw) as T[];
      if (!Array.isArray(parsed)) throw new Error('expected a JSON array');
      this.cache = new Map(parsed.map((item) => [item.id, item]));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        // Never silently overwrite a file we could not parse: move it aside so
        // the data can still be recovered by hand.
        const backup = `${this.path}.corrupt-${Date.now()}`;
        await rename(this.path, backup).catch(() => undefined);
        console.warn(`[store] could not read ${this.path} — moved it to ${backup}`);
      }
      this.cache = new Map(this.defaults().map((item) => [item.id, item]));
    }
  }

  private async persist(): Promise<void> {
    const items = [...(this.cache?.values() ?? [])];
    const serialized = `${JSON.stringify(items, null, 2)}\n`;
    this.writing = this.writing.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.${process.pid}.tmp`;
      await writeFile(tmp, serialized, 'utf8');
      await rename(tmp, this.path);
    });
    await this.writing;
  }

  all(): T[] {
    return [...(this.cache?.values() ?? [])];
  }

  get(id: string): T | undefined {
    return this.cache?.get(id);
  }

  async put(item: T): Promise<T> {
    await this.load();
    this.cache?.set(item.id, item);
    await this.persist();
    return item;
  }

  async remove(id: string): Promise<boolean> {
    await this.load();
    const deleted = this.cache?.delete(id) ?? false;
    if (deleted) await this.persist();
    return deleted;
  }

  async replaceAll(items: T[]): Promise<void> {
    await this.load();
    this.cache = new Map(items.map((item) => [item.id, item]));
    await this.persist();
  }
}

/** Settings are stored as a single JSON document rather than a collection. */
export class SettingsStore<S extends object> {
  private cache: S | null = null;
  /** Single-flight guard so concurrent callers share one read. */
  private loading: Promise<S> | null = null;

  private readonly file: string;
  private readonly defaults: () => S;

  constructor(file: string, defaults: () => S) {
    this.file = file;
    this.defaults = defaults;
  }

  async get(): Promise<S> {
    if (this.cache) return this.cache;
    this.loading ??= this.read();
    return this.loading;
  }

  private async read(): Promise<S> {
    try {
      const raw = await readFile(this.file, 'utf8');
      this.cache = { ...this.defaults(), ...(JSON.parse(raw) as Partial<S>) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        const backup = `${this.file}.corrupt-${Date.now()}`;
        await rename(this.file, backup).catch(() => undefined);
        console.warn(`[store] could not read ${this.file} — moved it to ${backup}`);
      }
      this.cache = this.defaults();
    }
    return this.cache;
  }

  async set(patch: Partial<S>): Promise<S> {
    const current = await this.get();
    const next = { ...current, ...patch };
    this.cache = next;
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(tmp, this.file);
    return next;
  }
}

export function storePaths(dataDir: string) {
  return {
    projects: join(dataDir, 'projects.json'),
    runs: join(dataDir, 'runs.json'),
    settings: join(dataDir, 'settings.json'),
  };
}
