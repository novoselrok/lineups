import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LineupInput } from '../shared/types';
import { createJsonStore } from './store';

function input(overrides: Partial<LineupInput> = {}): LineupInput {
  return {
    name: 'My XI',
    formationId: '4-3-3',
    assignments: { gk: 'liv-alisson', st1: 'mci-haaland' },
    kitMode: 'club',
    customKit: null,
    ...overrides,
  };
}

describe('createJsonStore', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lineups-store-'));
    file = join(dir, 'lineups.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('starts empty when the file does not exist', async () => {
    const store = createJsonStore(file);
    expect(await store.list()).toEqual([]);
  });

  it('creates a lineup with server-owned id and timestamps', async () => {
    const store = createJsonStore(file, {
      newId: () => 'fixed-id',
      now: () => '2026-01-01T00:00:00.000Z',
    });
    const created = await store.create(input({ name: 'Champions' }));

    expect(created).toMatchObject({
      id: 'fixed-id',
      name: 'Champions',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('writes lineups to disk as readable JSON', async () => {
    const store = createJsonStore(file);
    await store.create(input({ name: 'On Disk' }));

    const parsed = JSON.parse(await readFile(file, 'utf8'));
    expect(parsed.version).toBe(1);
    expect(parsed.lineups).toHaveLength(1);
    expect(parsed.lineups[0].name).toBe('On Disk');
  });

  it('reads lineups back through a fresh store instance', async () => {
    const first = createJsonStore(file);
    const created = await first.create(input({ name: 'Persisted' }));

    const second = createJsonStore(file);
    const loaded = await second.get(created.id);
    expect(loaded).toEqual(created);
  });

  it('returns undefined for an unknown id', async () => {
    const store = createJsonStore(file);
    expect(await store.get('nope')).toBeUndefined();
  });

  it('updates a lineup, keeping id and createdAt but refreshing updatedAt', async () => {
    let clock = '2026-01-01T00:00:00.000Z';
    const store = createJsonStore(file, { now: () => clock });
    const created = await store.create(input());

    clock = '2026-02-02T00:00:00.000Z';
    const updated = await store.update(
      created.id,
      input({
        name: 'Renamed',
        kitMode: 'custom',
        customKit: {
          shirt: '#000000',
          sleeve: '#111111',
          shorts: '#222222',
          number: '#ffffff',
          pattern: 'solid',
        },
      }),
    );

    expect(updated).toMatchObject({
      id: created.id,
      name: 'Renamed',
      kitMode: 'custom',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-02T00:00:00.000Z',
    });
  });

  it('returns undefined when updating a lineup that does not exist', async () => {
    const store = createJsonStore(file);
    expect(await store.update('ghost', input())).toBeUndefined();
  });

  it('removes a lineup and reports whether it existed', async () => {
    const store = createJsonStore(file);
    const created = await store.create(input());

    expect(await store.remove(created.id)).toBe(true);
    expect(await store.remove(created.id)).toBe(false);
    expect(await store.list()).toEqual([]);
  });

  it('persists removals to disk', async () => {
    const store = createJsonStore(file);
    const created = await store.create(input());
    await store.remove(created.id);

    const reloaded = createJsonStore(file);
    expect(await reloaded.list()).toEqual([]);
  });

  it('summarises lineups with a player count, newest first', async () => {
    let clock = '2026-01-01T00:00:00.000Z';
    const store = createJsonStore(file, { now: () => clock });
    await store.create(input({ name: 'Older', assignments: { gk: 'liv-alisson' } }));
    clock = '2026-03-03T00:00:00.000Z';
    await store.create(input({ name: 'Newer', assignments: { gk: 'bay-neuer', st1: 'bay-kane' } }));

    const list = await store.list();
    expect(list.map((l) => l.name)).toEqual(['Newer', 'Older']);
    expect(list[0]!.playerCount).toBe(2);
    expect(list[1]!.playerCount).toBe(1);
  });

  it('starts empty and warns when the file is not valid JSON', async () => {
    await writeFile(file, '{ this is not json', 'utf8');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const store = createJsonStore(file);
    expect(await store.list()).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('starts empty and warns when the file has the wrong shape', async () => {
    await writeFile(file, JSON.stringify({ version: 99, lineups: 'nope' }), 'utf8');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const store = createJsonStore(file);
    expect(await store.list()).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('rejects a stored lineup whose assignments break the formation contract', async () => {
    // Same player in two slots — the schema should refuse to load this.
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        lineups: [
          {
            ...input({ assignments: { gk: 'liv-alisson', st1: 'liv-alisson' } }),
            id: 'bad',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      'utf8',
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const store = createJsonStore(file);
    expect(await store.list()).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('creates the parent directory when it is missing', async () => {
    const nested = join(dir, 'deep', 'nested', 'lineups.json');
    const store = createJsonStore(nested);
    await store.create(input({ name: 'Nested' }));

    const reloaded = createJsonStore(nested);
    expect((await reloaded.list())[0]!.name).toBe('Nested');
  });

  it('does not lose writes when saves are issued concurrently', async () => {
    const store = createJsonStore(file);
    await Promise.all(
      Array.from({ length: 12 }, (_, i) => store.create(input({ name: `Lineup ${i}` }))),
    );

    const reloaded = createJsonStore(file);
    expect(await reloaded.list()).toHaveLength(12);
  });

  it('leaves no temporary files behind', async () => {
    const store = createJsonStore(file);
    await store.create(input());

    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(dir);
    expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([]);
  });
});
