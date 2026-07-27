/**
 * The bundled player catalog.
 *
 * These squads are a hand-authored, plausible snapshot rather than a live feed — there is
 * no external API in the loop, which keeps the app fully offline and the tests
 * deterministic. Club kit colours are the real first-choice strips. To swap in your own
 * data, replace `clubs.json` / `players.json`; `catalog.test.ts` enforces the invariants
 * the app relies on (unique ids, one squad number per club, known club references).
 */
import { FORMATIONS } from '../shared/formations';
import { clubSchema, playerSchema } from '../shared/schemas';
import { compareByRole } from '../shared/roles';
import type { Catalog, Club, Player } from '../shared/types';
import type { PositionRole } from '../shared/roles';
import clubsJson from './clubs.json' with { type: 'json' };
import playersJson from './players.json' with { type: 'json' };

export const CLUBS: Club[] = clubSchema.array().parse(clubsJson);
export const PLAYERS: Player[] = playerSchema.array().parse(playersJson);

export const CLUBS_BY_ID: ReadonlyMap<string, Club> = new Map(CLUBS.map((c) => [c.id, c]));
export const PLAYERS_BY_ID: ReadonlyMap<string, Player> = new Map(PLAYERS.map((p) => [p.id, p]));

export const CATALOG: Catalog = {
  clubs: CLUBS,
  players: PLAYERS,
  formations: FORMATIONS,
};

export function findPlayer(id: string): Player | undefined {
  return PLAYERS_BY_ID.get(id);
}

export function findClub(id: string): Club | undefined {
  return CLUBS_BY_ID.get(id);
}

export interface PlayerQuery {
  /** Free text matched against player name and club name, case-insensitive. */
  q?: string;
  /** Restrict to players listed for this position. */
  role?: PositionRole;
  clubId?: string;
  limit?: number;
}

/**
 * Powers the search modal. Results are ordered by role (back to front) then by name so
 * the list is stable between keystrokes.
 */
export function searchPlayers(query: PlayerQuery, players: readonly Player[] = PLAYERS): Player[] {
  const needle = query.q?.trim().toLowerCase();

  const matches = players.filter((player) => {
    if (query.role && !player.roles.includes(query.role)) return false;
    if (query.clubId && player.clubId !== query.clubId) return false;
    if (needle) {
      const clubName = CLUBS_BY_ID.get(player.clubId)?.name ?? '';
      const haystack = `${player.name} ${clubName}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  matches.sort((a, b) => compareByRole(a.roles, b.roles) || a.name.localeCompare(b.name));

  return query.limit != null ? matches.slice(0, query.limit) : matches;
}
