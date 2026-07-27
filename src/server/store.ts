import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { storeFileSchema } from '../shared/schemas';
import type { Lineup, LineupInput, LineupSummary } from '../shared/types';

export interface LineupStore {
  list(): Promise<LineupSummary[]>;
  get(id: string): Promise<Lineup | undefined>;
  create(input: LineupInput): Promise<Lineup>;
  update(id: string, input: LineupInput): Promise<Lineup | undefined>;
  remove(id: string): Promise<boolean>;
}

const CURRENT_VERSION = 1;

function summarise(lineup: Lineup): LineupSummary {
  return {
    id: lineup.id,
    name: lineup.name,
    formationId: lineup.formationId,
    playerCount: Object.keys(lineup.assignments).length,
    updatedAt: lineup.updatedAt,
  };
}

export interface JsonStoreOptions {
  /** Overridable so tests can use fixed ids and timestamps. */
  newId?: () => string;
  now?: () => string;
}

/**
 * Lineups persisted as a single JSON file.
 *
 * Reads are served from an in-memory map loaded once on first access. Writes rewrite the
 * whole file to a temporary path and `rename` it over the target, which is atomic on the
 * same filesystem — a crash mid-write leaves the previous file intact rather than a
 * truncated one. All writes are chained through a single promise so two concurrent saves
 * cannot interleave and lose data.
 */
export function createJsonStore(filePath: string, options: JsonStoreOptions = {}): LineupStore {
  const absolutePath = resolve(filePath);
  const newId = options.newId ?? (() => randomUUID());
  const now = options.now ?? (() => new Date().toISOString());

  // Memoises the in-flight promise, not just the resolved map: concurrent first calls must
  // share one load, otherwise each would install its own cache and later writes would
  // silently drop everything the others had added.
  let cachePromise: Promise<Map<string, Lineup>> | null = null;
  let writeQueue: Promise<unknown> = Promise.resolve();

  function load(): Promise<Map<string, Lineup>> {
    cachePromise ??= readStore().catch((error: unknown) => {
      cachePromise = null; // let a later call retry instead of caching the failure
      throw error;
    });
    return cachePromise;
  }

  async function readStore(): Promise<Map<string, Lineup>> {
    let raw: string;
    try {
      raw = await readFile(absolutePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map();
      throw error;
    }

    // An empty, malformed or hand-edited file should not take the app down — start empty
    // and let the next save rewrite it.
    const parsed = storeFileSchema.safeParse(safeJsonParse(raw));
    if (!parsed.success) {
      console.warn(
        `[store] ${absolutePath} is not a valid lineup store; starting empty. ` +
          `First issue: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
      );
      return new Map();
    }

    return new Map(parsed.data.lineups.map((lineup) => [lineup.id, lineup]));
  }

  /** Serialises writes so two concurrent saves cannot interleave. */
  function persist(lineups: Map<string, Lineup>): Promise<void> {
    const task = writeQueue.then(async () => {
      const payload = JSON.stringify(
        { version: CURRENT_VERSION, lineups: [...lineups.values()] },
        null,
        2,
      );
      await mkdir(dirname(absolutePath), { recursive: true });
      const tmpPath = `${absolutePath}.${process.pid}.tmp`;
      await writeFile(tmpPath, `${payload}\n`, 'utf8');
      await rename(tmpPath, absolutePath);
    });
    // Keep the chain alive even if one write fails, so later saves still run.
    writeQueue = task.catch(() => undefined);
    return task;
  }

  return {
    async list() {
      const lineups = await load();
      return [...lineups.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(summarise);
    },

    async get(id) {
      return (await load()).get(id);
    },

    async create(input) {
      const lineups = await load();
      const timestamp = now();
      const lineup: Lineup = { ...input, id: newId(), createdAt: timestamp, updatedAt: timestamp };
      lineups.set(lineup.id, lineup);
      await persist(lineups);
      return lineup;
    },

    async update(id, input) {
      const lineups = await load();
      const existing = lineups.get(id);
      if (!existing) return undefined;
      const lineup: Lineup = {
        ...input,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now(),
      };
      lineups.set(id, lineup);
      await persist(lineups);
      return lineup;
    },

    async remove(id) {
      const lineups = await load();
      if (!lineups.delete(id)) return false;
      await persist(lineups);
      return true;
    },
  };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** In-memory store for tests that do not care about the filesystem. */
export function createMemoryStore(options: JsonStoreOptions = {}): LineupStore {
  const newId = options.newId ?? (() => randomUUID());
  const now = options.now ?? (() => new Date().toISOString());
  const lineups = new Map<string, Lineup>();

  return {
    async list() {
      return [...lineups.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(summarise);
    },
    async get(id) {
      return lineups.get(id);
    },
    async create(input) {
      const timestamp = now();
      const lineup: Lineup = { ...input, id: newId(), createdAt: timestamp, updatedAt: timestamp };
      lineups.set(lineup.id, lineup);
      return lineup;
    },
    async update(id, input) {
      const existing = lineups.get(id);
      if (!existing) return undefined;
      const lineup: Lineup = {
        ...input,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now(),
      };
      lineups.set(id, lineup);
      return lineup;
    },
    async remove(id) {
      return lineups.delete(id);
    },
  };
}
