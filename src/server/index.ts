import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { CATALOG } from '../data/index';
import { createApp } from './app';
import { createJsonStore } from './store';

const PORT = Number(process.env.PORT ?? 8787);

/** Where saved lineups live. Overridable so E2E runs never touch your real file. */
const DATA_FILE = process.env.LINEUPS_DATA_FILE ?? 'data/lineups.json';

const clientDir = 'dist/client';
const hasBuiltClient = existsSync(new URL('../../dist/client/index.html', import.meta.url));

const app = createApp({
  store: createJsonStore(DATA_FILE),
  catalog: CATALOG,
});

// In dev the Vite server hosts the client and proxies /api here, so there is nothing to
// serve. In production this process serves both from a single origin.
if (hasBuiltClient) {
  app.use('/assets/*', serveStatic({ root: clientDir }));
  app.get('/favicon.ico', serveStatic({ path: `${clientDir}/favicon.ico` }));
  // SPA fallback: any non-/api route renders the app shell.
  app.get('*', serveStatic({ path: `${clientDir}/index.html` }));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
  console.log(`[api] lineups file: ${DATA_FILE}`);
  if (hasBuiltClient) {
    console.log(`[api] serving client from ${clientDir}`);
  } else {
    console.log('[api] no built client found — run the Vite dev server for the UI');
  }
});
