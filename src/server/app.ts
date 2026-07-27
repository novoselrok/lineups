import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { searchPlayers } from '../data/index';
import { FORMATIONS } from '../shared/formations';
import { isPositionRole } from '../shared/roles';
import { lineupInputSchema } from '../shared/schemas';
import type { Catalog } from '../shared/types';
import type { LineupStore } from './store';

export interface AppDeps {
  store: LineupStore;
  catalog: Catalog;
}

/**
 * Builds the API with its dependencies injected, so tests can drive it through
 * `app.request(...)` against a temp-file or in-memory store — no port, no cleanup.
 */
export function createApp({ store, catalog }: AppDeps) {
  const api = new Hono();

  api.get('/catalog', (c) =>
    c.json({ clubs: catalog.clubs, players: catalog.players, formations: catalog.formations }),
  );

  api.get('/formations', (c) => c.json(FORMATIONS));

  api.get('/players', (c) => {
    const role = c.req.query('role');
    if (role !== undefined && !isPositionRole(role)) {
      throw new HTTPException(400, { message: `Unknown position role: ${role}` });
    }

    const limitParam = c.req.query('limit');
    const limit = limitParam === undefined ? undefined : Number(limitParam);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      throw new HTTPException(400, { message: 'limit must be a positive integer' });
    }

    return c.json(
      searchPlayers(
        {
          q: c.req.query('q'),
          role,
          clubId: c.req.query('clubId'),
          limit,
        },
        catalog.players,
      ),
    );
  });

  api.get('/lineups', async (c) => c.json(await store.list()));

  api.get('/lineups/:id', async (c) => {
    const lineup = await store.get(c.req.param('id'));
    if (!lineup) throw new HTTPException(404, { message: 'Lineup not found' });
    return c.json(lineup);
  });

  api.post('/lineups', async (c) => {
    const input = await parseLineupBody(c.req.raw);
    return c.json(await store.create(input), 201);
  });

  api.put('/lineups/:id', async (c) => {
    const input = await parseLineupBody(c.req.raw);
    const updated = await store.update(c.req.param('id'), input);
    if (!updated) throw new HTTPException(404, { message: 'Lineup not found' });
    return c.json(updated);
  });

  api.delete('/lineups/:id', async (c) => {
    const removed = await store.remove(c.req.param('id'));
    if (!removed) throw new HTTPException(404, { message: 'Lineup not found' });
    return c.body(null, 204);
  });

  const app = new Hono();
  app.get('/api/health', (c) => c.json({ ok: true }));
  app.route('/api', api);

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      // Routes that need field-level detail attach their own JSON response.
      if (error.res) return error.res;
      return c.json({ error: error.message }, error.status);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid lineup', issues: formatIssues(error) }, 400);
    }
    console.error('[api] unhandled error', error);
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.notFound((c) =>
    c.req.path.startsWith('/api')
      ? c.json({ error: `No such endpoint: ${c.req.method} ${c.req.path}` }, 404)
      : c.text('Not found', 404),
  );

  return app;
}

export type ApiApp = ReturnType<typeof createApp>;

async function parseLineupBody(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HTTPException(400, { message: 'Request body must be JSON' });
  }

  const result = lineupInputSchema.safeParse(body);
  if (!result.success) {
    throw new HTTPException(400, {
      // Surface field-level detail so the client can point at the offending slot.
      res: Response.json(
        { error: 'Invalid lineup', issues: formatIssues(result.error) },
        { status: 400 },
      ),
    });
  }
  return result.data;
}

function formatIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
