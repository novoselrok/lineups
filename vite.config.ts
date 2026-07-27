import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export const API_PORT = Number(process.env.PORT ?? 8787);
export const CLIENT_PORT = Number(process.env.CLIENT_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': r('./src/shared'),
      '@data': r('./src/data'),
      '@client': r('./src/client'),
    },
  },
  server: {
    port: CLIENT_PORT,
    // The Hono API runs as a separate process in dev; production serves both from one origin.
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  test: {
    // Split by extension: pure logic lives in *.test.ts and runs in node, component tests
    // live in *.test.tsx and get a DOM.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          setupFiles: ['./src/client/test/setup.ts'],
          include: ['src/**/*.test.tsx'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/client/test/**', 'src/client/main.tsx'],
    },
  },
});
