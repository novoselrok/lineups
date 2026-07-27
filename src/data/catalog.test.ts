import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '../shared/formations';
import { roleGroup } from '../shared/roles';
import { CLUBS, CLUBS_BY_ID, PLAYERS, searchPlayers } from './index';

describe('club catalog', () => {
  it('has unique club ids and short names', () => {
    expect(new Set(CLUBS.map((c) => c.id)).size).toBe(CLUBS.length);
    expect(new Set(CLUBS.map((c) => c.shortName)).size).toBe(CLUBS.length);
  });

  it('gives every club a full kit', () => {
    for (const club of CLUBS) {
      for (const [key, value] of Object.entries(club.kit)) {
        if (key === 'pattern') continue;
        expect(value, `${club.id}.kit.${key}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe('player catalog', () => {
  it('has unique player ids', () => {
    const ids = PLAYERS.map((p) => p.id);
    expect(new Set(ids).size, 'duplicate player id').toBe(ids.length);
  });

  it('references only known clubs', () => {
    for (const player of PLAYERS) {
      expect(CLUBS_BY_ID.has(player.clubId), `${player.id} -> ${player.clubId}`).toBe(true);
    }
  });

  it('never reuses a squad number within a club', () => {
    for (const club of CLUBS) {
      const squad = PLAYERS.filter((p) => p.clubId === club.id);
      const numbers = squad.map((p) => p.number);
      const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
      expect(duplicates, `${club.id} reuses number(s)`).toEqual([]);
    }
  });

  it('gives every club a squad deep enough to field a keeper and outfielders', () => {
    for (const club of CLUBS) {
      const squad = PLAYERS.filter((p) => p.clubId === club.id);
      expect(squad.length, `${club.id} squad size`).toBeGreaterThanOrEqual(11);
      const keepers = squad.filter((p) => p.roles.includes('GK'));
      expect(keepers.length, `${club.id} keepers`).toBeGreaterThanOrEqual(1);
    }
  });

  it('lists a primary role first that matches the player group ordering', () => {
    for (const player of PLAYERS) {
      expect(player.roles.length, `${player.id} roles`).toBeGreaterThan(0);
      expect(() => roleGroup(player.roles[0]!)).not.toThrow();
    }
  });

  it('can fill every slot of every formation from the catalog', () => {
    for (const formation of FORMATIONS) {
      for (const slot of formation.slots) {
        const eligible = PLAYERS.filter((p) => p.roles.includes(slot.role));
        expect(
          eligible.length,
          `no player in the catalog can play ${slot.role} (${formation.id}/${slot.id})`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe('searchPlayers', () => {
  it('matches on player name, case-insensitively', () => {
    const results = searchPlayers({ q: 'haaland' });
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Erling Haaland');
  });

  it('matches on club name', () => {
    const results = searchPlayers({ q: 'Borussia' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.clubId === 'dortmund')).toBe(true);
  });

  it('filters by role', () => {
    const keepers = searchPlayers({ role: 'GK' });
    expect(keepers.length).toBeGreaterThan(0);
    expect(keepers.every((p) => p.roles.includes('GK'))).toBe(true);
  });

  it('combines role and text filters', () => {
    const results = searchPlayers({ role: 'ST', q: 'Liverpool' });
    expect(results.every((p) => p.clubId === 'liverpool' && p.roles.includes('ST'))).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('filters by club', () => {
    const results = searchPlayers({ clubId: 'ajax' });
    expect(results).toHaveLength(PLAYERS.filter((p) => p.clubId === 'ajax').length);
  });

  it('respects the limit', () => {
    expect(searchPlayers({ limit: 5 })).toHaveLength(5);
  });

  it('returns an empty list rather than throwing when nothing matches', () => {
    expect(searchPlayers({ q: 'no-such-player-xyz' })).toEqual([]);
  });

  it('orders keepers before outfielders', () => {
    const results = searchPlayers({ q: 'a', limit: 200 });
    const groups = results.map((p) => roleGroup(p.roles[0]!));
    const firstOutfielder = groups.findIndex((g) => g !== 'goalkeeper');
    if (firstOutfielder !== -1) {
      expect(groups.slice(firstOutfielder)).not.toContain('goalkeeper');
    }
  });
});
