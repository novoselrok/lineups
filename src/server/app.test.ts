import { beforeEach, describe, expect, it } from 'vitest';
import { CATALOG } from '../data/index';
import type { Kit, Lineup, LineupInput, LineupSummary } from '../shared/types';
import { createApp } from './app';
import { createMemoryStore } from './store';

const CUSTOM_KIT: Kit = {
  shirt: '#c8102e',
  sleeve: '#a00d24',
  shorts: '#ffffff',
  number: '#ffffff',
  pattern: 'solid',
};

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

function makeApp() {
  let counter = 0;
  const store = createMemoryStore({
    newId: () => `lineup-${++counter}`,
    now: () => '2026-01-01T00:00:00.000Z',
  });
  return { app: createApp({ store, catalog: CATALOG }), store };
}

let app: ReturnType<typeof makeApp>['app'];

beforeEach(() => {
  app = makeApp().app;
});

const postJson = (body: unknown) =>
  app.request('/api/lineups', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('GET /api/catalog', () => {
  it('returns clubs, players and formations', async () => {
    const res = await app.request('/api/catalog');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.clubs.length).toBeGreaterThan(0);
    expect(body.players.length).toBeGreaterThan(0);
    expect(body.formations.length).toBeGreaterThan(0);
    expect(body.formations[0].slots).toHaveLength(11);
  });
});

describe('GET /api/players', () => {
  it('returns every player with no filters', async () => {
    const res = await app.request('/api/players');
    expect((await res.json()).length).toBe(CATALOG.players.length);
  });

  it('filters by free text', async () => {
    const res = await app.request('/api/players?q=haaland');
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Erling Haaland');
  });

  it('filters by role', async () => {
    const res = await app.request('/api/players?role=GK');
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((p: { roles: string[] }) => p.roles.includes('GK'))).toBe(true);
  });

  it('honours limit', async () => {
    const res = await app.request('/api/players?limit=3');
    expect(await res.json()).toHaveLength(3);
  });

  it('rejects an unknown role', async () => {
    const res = await app.request('/api/players?role=SWEEPER');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Unknown position role/);
  });

  it('rejects a non-numeric limit', async () => {
    const res = await app.request('/api/players?limit=abc');
    expect(res.status).toBe(400);
  });

  it('rejects a zero limit', async () => {
    const res = await app.request('/api/players?limit=0');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/lineups', () => {
  it('creates a lineup and returns 201 with server-owned fields', async () => {
    const res = await postJson(input({ name: 'Champions' }));
    expect(res.status).toBe(201);

    const body: Lineup = await res.json();
    expect(body).toMatchObject({
      id: 'lineup-1',
      name: 'Champions',
      formationId: '4-3-3',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('accepts a custom kit', async () => {
    const res = await postJson(input({ kitMode: 'custom', customKit: CUSTOM_KIT }));
    expect(res.status).toBe(201);
    expect((await res.json()).customKit).toEqual(CUSTOM_KIT);
  });

  it('accepts a lineup with no players assigned yet', async () => {
    const res = await postJson(input({ assignments: {} }));
    expect(res.status).toBe(201);
  });

  it('rejects a body that is not JSON', async () => {
    const res = await app.request('/api/lineups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json at all',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a blank name', async () => {
    const res = await postJson(input({ name: '   ' }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Invalid lineup');
    expect(body.issues.some((i: { path: string }) => i.path === 'name')).toBe(true);
  });

  it('rejects an unknown formation', async () => {
    const res = await postJson(input({ formationId: '9-9-9' }));
    expect(res.status).toBe(400);
    expect((await res.json()).issues[0].message).toMatch(/Unknown formation/);
  });

  it('rejects a slot that does not exist in the chosen formation', async () => {
    // 'lwb' belongs to 3-5-2 / 5-3-2, not 4-3-3.
    const res = await postJson(
      input({ formationId: '4-3-3', assignments: { lwb: 'liv-robertson' } }),
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.issues[0].message).toMatch(/does not exist in formation 4-3-3/);
  });

  it('rejects the same player assigned to two slots', async () => {
    const res = await postJson(input({ assignments: { st1: 'mci-haaland', lw: 'mci-haaland' } }));
    expect(res.status).toBe(400);
    expect((await res.json()).issues[0].message).toMatch(/already assigned/);
  });

  it('rejects a malformed custom kit colour', async () => {
    const res = await postJson(
      input({ kitMode: 'custom', customKit: { ...CUSTOM_KIT, shirt: 'red' } }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).issues[0].message).toMatch(/hex colour/);
  });

  it('rejects an unknown kit pattern', async () => {
    const res = await postJson(
      input({ kitMode: 'custom', customKit: { ...CUSTOM_KIT, pattern: 'polkadot' } as never }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/lineups', () => {
  it('starts empty', async () => {
    expect(await (await app.request('/api/lineups')).json()).toEqual([]);
  });

  it('summarises saved lineups with a player count', async () => {
    await postJson(input({ name: 'First', assignments: { gk: 'liv-alisson' } }));

    const body: LineupSummary[] = await (await app.request('/api/lineups')).json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ name: 'First', formationId: '4-3-3', playerCount: 1 });
  });
});

describe('GET /api/lineups/:id', () => {
  it('returns a saved lineup', async () => {
    const created: Lineup = await (await postJson(input({ name: 'Fetch me' }))).json();

    const res = await app.request(`/api/lineups/${created.id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(created);
  });

  it('404s for an unknown id', async () => {
    const res = await app.request('/api/lineups/does-not-exist');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Lineup not found');
  });
});

describe('PUT /api/lineups/:id', () => {
  const put = (id: string, body: unknown) =>
    app.request(`/api/lineups/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('replaces a lineup, keeping its id', async () => {
    const created: Lineup = await (await postJson(input())).json();

    const res = await put(
      created.id,
      input({ name: 'Renamed', formationId: '3-5-2', assignments: {} }),
    );
    expect(res.status).toBe(200);

    const body: Lineup = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.name).toBe('Renamed');
    expect(body.formationId).toBe('3-5-2');
  });

  it('switches a saved lineup to a custom kit', async () => {
    const created: Lineup = await (await postJson(input())).json();

    const res = await put(created.id, input({ kitMode: 'custom', customKit: CUSTOM_KIT }));
    const body: Lineup = await res.json();
    expect(body.kitMode).toBe('custom');
    expect(body.customKit).toEqual(CUSTOM_KIT);
  });

  it('404s for an unknown id', async () => {
    expect((await put('ghost', input())).status).toBe(404);
  });

  it('validates the body before touching the store', async () => {
    const created: Lineup = await (await postJson(input({ name: 'Keep me' }))).json();

    expect((await put(created.id, input({ name: '' }))).status).toBe(400);

    const unchanged: Lineup = await (await app.request(`/api/lineups/${created.id}`)).json();
    expect(unchanged.name).toBe('Keep me');
  });
});

describe('DELETE /api/lineups/:id', () => {
  it('removes a lineup and returns 204', async () => {
    const created: Lineup = await (await postJson(input())).json();

    const res = await app.request(`/api/lineups/${created.id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect((await app.request(`/api/lineups/${created.id}`)).status).toBe(404);
  });

  it('404s when deleting something that is not there', async () => {
    const res = await app.request('/api/lineups/ghost', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('unknown endpoints', () => {
  it('returns a JSON 404 under /api', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/No such endpoint/);
  });
});
