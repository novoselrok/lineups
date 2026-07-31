# Lineups

A football lineup simulator. Pick a formation, fill the eleven positions by dragging players
in or by clicking a position and searching, then name the lineup and save it locally. Players
wear their club colours by default; you can put the whole team in one custom kit instead.

## Requirements

- Node.js 22 or newer (developed on 24)
- npm

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` starts two processes:

- the Hono API on <http://localhost:8787>, which owns the JSON store
- the Vite dev server on <http://localhost:5173>, which proxies `/api` to the API

Open <http://localhost:5173>.

For a production-shaped run, where one process serves both the API and the built client:

```bash
npm run build
npm start          # http://localhost:8787
```

## How it works

| Concern                                    | Where         |
| ------------------------------------------ | ------------- |
| Domain types, formations, kits, validation | `src/shared/` |
| Bundled clubs and players                  | `src/data/`   |
| API and persistence                        | `src/server/` |
| UI                                         | `src/client/` |

**Formations.** `src/shared/formations.ts` defines seven formations (4-4-2, 4-3-3, 4-2-3-1,
4-1-4-1, 3-5-2, 3-4-3, 5-3-2). Each has exactly eleven slots positioned as percentages of the
pitch, so the pitch scales without hard-coded pixels.

**All lineup edits go through one pure reducer**, `src/client/state/lineupReducer.ts`. It
guarantees a player is never on the pitch twice and never assigns a slot the current formation
does not have. Changing formation re-seats players in three passes — same slot id, then exact
position, then position group (a CM can fill a CDM slot) — and reports anyone it could not
place instead of dropping them silently.

**Kits.** `resolveKit()` in `src/shared/kits.ts` is the single source of truth for shirt
colours: club colours in `club` mode, the lineup's theme in `custom` mode. Shirts are SVG, so
a theme is just four colours plus a pattern (solid, stripes, halves, sash).

**Persistence.** Lineups live in one JSON file, `data/lineups.json` by default (override with
`LINEUPS_DATA_FILE`). Writes go to a temporary file and are then renamed over the target,
which is atomic on the same filesystem, and are serialised through a single promise so
concurrent saves cannot interleave. A missing or corrupt file starts empty with a warning
rather than crashing. Everything sits behind the `LineupStore` interface in
`src/server/store.ts`, so swapping in SQLite later means writing one new implementation.

### Player data

`src/data/clubs.json` and `src/data/players.json` bundle 14 clubs and 263 players. Club kit
colours are the real first-choice strips; the squads are a hand-authored, plausible snapshot
rather than a live feed, since there is no external API in the loop. That keeps the app fully
offline and the tests deterministic. Replace those two files to use your own data —
`src/data/catalog.test.ts` enforces the invariants the app relies on (unique ids, one squad
number per club, known club references, and every formation slot fillable).

## API

| Method | Path                                   | Purpose                       |
| ------ | -------------------------------------- | ----------------------------- |
| GET    | `/api/health`                          | Liveness                      |
| GET    | `/api/catalog`                         | Clubs, players and formations |
| GET    | `/api/players?q=&role=&clubId=&limit=` | Player search                 |
| GET    | `/api/formations`                      | Formations                    |
| GET    | `/api/lineups`                         | Saved lineup summaries        |
| GET    | `/api/lineups/:id`                     | One lineup                    |
| POST   | `/api/lineups`                         | Create                        |
| PUT    | `/api/lineups/:id`                     | Replace                       |
| DELETE | `/api/lineups/:id`                     | Delete                        |

Request bodies are validated with the Zod schemas in `src/shared/schemas.ts`, shared by client
and server. A 400 lists the offending fields, including a slot that does not belong to the
chosen formation or a player assigned twice.

## Commands

| Command                           | Purpose                                    |
| --------------------------------- | ------------------------------------------ |
| `npm run dev`                     | API and client with hot reload             |
| `npm run build`                   | Build the client to `dist/client`          |
| `npm start`                       | Serve API and built client from one origin |
| `npm run typecheck`               | `tsc --noEmit`                             |
| `npm run lint` / `lint:fix`       | ESLint                                     |
| `npm run format` / `format:check` | Prettier                                   |
| `npm test` / `npm run test:unit`  | Vitest, both projects                      |
| `npm run test:watch`              | Vitest in watch mode                       |

## Tests

Vitest runs two projects, split by file extension:

- **`unit`** (`*.test.ts`, node): formation integrity, the lineup reducer, kit resolution, the
  JSON store (temp directories, corrupt files, concurrent writes) and every API route.
- **`client`** (`*.test.tsx`, jsdom): the pitch, the search modal, the kit panel, and an
  `App` suite driving the whole editor against a fake API.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on every pull request, cancelling
superseded runs:

- **check** — typecheck, lint, format check, unit and component tests with coverage, and a build

## Accessibility notes

Positions are buttons with descriptive labels, so the whole lineup can be built from the
keyboard through the search modal. Filled positions also expose a separate drag handle: it is
kept apart from the main button so Space and Enter do not have to mean both "open the search"
and "pick this player up". Squad numbers pick black or white automatically from the shirt
colour's relative luminance, so they stay readable on any custom kit.

## Known issues

`npm audit` reports advisories in `brace-expansion`/`minimatch`, reached only through ESLint's
own dependencies. They affect linting in development, not the running app, and clearing them
needs a major ESLint bump.
