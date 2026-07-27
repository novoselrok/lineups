/** Every position a player can be listed for, and the groups formations reason about. */

export const POSITION_ROLES = [
  'GK',
  'CB',
  'LB',
  'RB',
  'LWB',
  'RWB',
  'CDM',
  'CM',
  'CAM',
  'LM',
  'RM',
  'LW',
  'RW',
  'CF',
  'ST',
] as const;

export type PositionRole = (typeof POSITION_ROLES)[number];

export type RoleGroup = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';

const ROLE_GROUPS: Record<PositionRole, RoleGroup> = {
  GK: 'goalkeeper',
  CB: 'defender',
  LB: 'defender',
  RB: 'defender',
  LWB: 'defender',
  RWB: 'defender',
  CDM: 'midfielder',
  CM: 'midfielder',
  CAM: 'midfielder',
  LM: 'midfielder',
  RM: 'midfielder',
  LW: 'forward',
  RW: 'forward',
  CF: 'forward',
  ST: 'forward',
};

export function roleGroup(role: PositionRole): RoleGroup {
  return ROLE_GROUPS[role];
}

export function isPositionRole(value: unknown): value is PositionRole {
  return typeof value === 'string' && (POSITION_ROLES as readonly string[]).includes(value);
}

/**
 * True when a player listing `roles` can play `slotRole` without compromise.
 * Used to pre-filter the search modal and to highlight valid drop targets.
 */
export function playsRole(roles: readonly PositionRole[], slotRole: PositionRole): boolean {
  return roles.includes(slotRole);
}

/**
 * Looser check: the player covers the same area of the pitch. A CM dropped into a
 * CDM slot is a reasonable suggestion; a GK dropped there is not.
 */
export function playsRoleGroup(roles: readonly PositionRole[], slotRole: PositionRole): boolean {
  const target = roleGroup(slotRole);
  return roles.some((role) => roleGroup(role) === target);
}

/** Ordering for player pools and search results: back to front. */
const GROUP_ORDER: Record<RoleGroup, number> = {
  goalkeeper: 0,
  defender: 1,
  midfielder: 2,
  forward: 3,
};

export function compareByRole(a: readonly PositionRole[], b: readonly PositionRole[]): number {
  const rank = (roles: readonly PositionRole[]) =>
    roles.length > 0 ? GROUP_ORDER[roleGroup(roles[0]!)] : Number.MAX_SAFE_INTEGER;
  return rank(a) - rank(b);
}
