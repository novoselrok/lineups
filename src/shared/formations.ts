import type { Formation, FormationSlot } from './types';
import type { PositionRole } from './roles';

export const SLOTS_PER_FORMATION = 11;

/**
 * Coordinates are percentages of the pitch box: x from left touchline to right,
 * y from the team's own goal line up towards the opponent's. The pitch component
 * positions slots with `left: x%` / `bottom: y%`, so formations stay responsive.
 */
function slot(id: string, role: PositionRole, x: number, y: number, label?: string): FormationSlot {
  return { id, role, label: label ?? role, x, y };
}

const BACK_FOUR = [
  slot('lb', 'LB', 14, 26),
  slot('cb1', 'CB', 38, 23),
  slot('cb2', 'CB', 62, 23),
  slot('rb', 'RB', 86, 26),
];

const BACK_THREE = [
  slot('cb1', 'CB', 28, 23),
  slot('cb2', 'CB', 50, 21),
  slot('cb3', 'CB', 72, 23),
];

const GK = slot('gk', 'GK', 50, 6);

export const FORMATIONS: Formation[] = [
  {
    id: '4-4-2',
    name: '4-4-2',
    slots: [
      GK,
      ...BACK_FOUR,
      slot('lm', 'LM', 14, 55),
      slot('cm1', 'CM', 38, 52),
      slot('cm2', 'CM', 62, 52),
      slot('rm', 'RM', 86, 55),
      slot('st1', 'ST', 38, 82),
      slot('st2', 'ST', 62, 82),
    ],
  },
  {
    id: '4-3-3',
    name: '4-3-3',
    slots: [
      GK,
      ...BACK_FOUR,
      slot('cdm', 'CDM', 50, 48),
      slot('cm1', 'CM', 28, 56),
      slot('cm2', 'CM', 72, 56),
      slot('lw', 'LW', 16, 80),
      slot('st1', 'ST', 50, 86),
      slot('rw', 'RW', 84, 80),
    ],
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    slots: [
      GK,
      ...BACK_FOUR,
      slot('cdm1', 'CDM', 38, 44),
      slot('cdm2', 'CDM', 62, 44),
      slot('lm', 'LM', 16, 64),
      slot('cam', 'CAM', 50, 66),
      slot('rm', 'RM', 84, 64),
      slot('st1', 'ST', 50, 86),
    ],
  },
  {
    id: '4-1-4-1',
    name: '4-1-4-1',
    slots: [
      GK,
      ...BACK_FOUR,
      slot('cdm', 'CDM', 50, 42),
      slot('lm', 'LM', 14, 62),
      slot('cm1', 'CM', 38, 60),
      slot('cm2', 'CM', 62, 60),
      slot('rm', 'RM', 86, 62),
      slot('st1', 'ST', 50, 86),
    ],
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    slots: [
      GK,
      ...BACK_THREE,
      slot('lwb', 'LWB', 10, 50),
      slot('cm1', 'CM', 32, 56),
      slot('cdm', 'CDM', 50, 44),
      slot('cm2', 'CM', 68, 56),
      slot('rwb', 'RWB', 90, 50),
      slot('st1', 'ST', 38, 84),
      slot('st2', 'ST', 62, 84),
    ],
  },
  {
    id: '3-4-3',
    name: '3-4-3',
    slots: [
      GK,
      ...BACK_THREE,
      slot('lm', 'LM', 14, 52),
      slot('cm1', 'CM', 38, 50),
      slot('cm2', 'CM', 62, 50),
      slot('rm', 'RM', 86, 52),
      slot('lw', 'LW', 18, 80),
      slot('st1', 'ST', 50, 86),
      slot('rw', 'RW', 82, 80),
    ],
  },
  {
    id: '5-3-2',
    name: '5-3-2',
    slots: [
      GK,
      slot('lwb', 'LWB', 10, 32),
      slot('cb1', 'CB', 30, 22),
      slot('cb2', 'CB', 50, 20),
      slot('cb3', 'CB', 70, 22),
      slot('rwb', 'RWB', 90, 32),
      slot('cm1', 'CM', 30, 56),
      slot('cdm', 'CDM', 50, 52),
      slot('cm2', 'CM', 70, 56),
      slot('st1', 'ST', 38, 84),
      slot('st2', 'ST', 62, 84),
    ],
  },
];

export const DEFAULT_FORMATION_ID = '4-3-3';

const BY_ID = new Map(FORMATIONS.map((f) => [f.id, f]));

export function findFormation(id: string): Formation | undefined {
  return BY_ID.get(id);
}

/** Throws for an unknown id — use when a missing formation is a programming error. */
export function getFormation(id: string): Formation {
  const formation = BY_ID.get(id);
  if (!formation) throw new Error(`Unknown formation: ${id}`);
  return formation;
}

export function findSlot(formationId: string, slotId: string): FormationSlot | undefined {
  return findFormation(formationId)?.slots.find((s) => s.id === slotId);
}
