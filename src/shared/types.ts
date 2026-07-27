import type { PositionRole } from './roles';

/** A shirt design. Colours are CSS hex strings so they drop straight into SVG fills. */
export type KitPattern = 'solid' | 'stripes' | 'halves' | 'sash';

export interface Kit {
  shirt: string;
  sleeve: string;
  shorts: string;
  /** Colour of the squad number printed on the shirt. */
  number: string;
  pattern: KitPattern;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  kit: Kit;
}

export interface Player {
  id: string;
  name: string;
  clubId: string;
  number: number;
  /** Positions the player is listed for, most natural first. */
  roles: PositionRole[];
}

/** One of the eleven spots on the pitch, positioned as a percentage of the pitch box. */
export interface FormationSlot {
  id: string;
  role: PositionRole;
  /** Short label drawn on an empty slot, e.g. "LB". */
  label: string;
  /** 0 = left touchline, 100 = right touchline. */
  x: number;
  /** 0 = own goal line, 100 = opponent goal line. */
  y: number;
}

export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
}

/** Whether players wear their own club colours or a single team-wide theme. */
export type KitMode = 'club' | 'custom';

export interface Lineup {
  id: string;
  name: string;
  formationId: string;
  /** slotId -> playerId. Absent key means the slot is empty. */
  assignments: Record<string, string>;
  kitMode: KitMode;
  /** The team-wide kit, used when `kitMode` is 'custom'. */
  customKit: Kit | null;
  createdAt: string;
  updatedAt: string;
}

/** Shape returned by the list endpoint — enough to render the saved-lineups list. */
export interface LineupSummary {
  id: string;
  name: string;
  formationId: string;
  playerCount: number;
  updatedAt: string;
}

/** Everything the client needs to render pickers and search. */
export interface Catalog {
  clubs: Club[];
  players: Player[];
  formations: Formation[];
}

/** Fields a client may set when creating or updating a lineup. */
export type LineupInput = Pick<
  Lineup,
  'name' | 'formationId' | 'assignments' | 'kitMode' | 'customKit'
>;
