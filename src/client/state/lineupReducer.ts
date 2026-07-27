import { DEFAULT_FORMATION_ID, getFormation } from '../../shared/formations';
import { DEFAULT_CUSTOM_KIT, findKitPreset } from '../../shared/kits';
import { playsRole, playsRoleGroup } from '../../shared/roles';
import type { Kit, KitMode, Lineup, Player } from '../../shared/types';

/**
 * The lineup being edited, plus the bits of editor state that belong with it.
 *
 * `savedId` is null until the lineup has been saved once; after that a save is a PUT.
 * `dirty` drives the unsaved-changes indicator. `lastRemapped` records players that a
 * formation change could not re-seat, so the UI can explain where they went.
 */
export interface EditorState {
  savedId: string | null;
  name: string;
  formationId: string;
  assignments: Record<string, string>;
  kitMode: KitMode;
  customKit: Kit;
  dirty: boolean;
  lastRemapped: { droppedPlayerIds: string[] } | null;
}

export type EditorAction =
  | { type: 'assignPlayer'; slotId: string; playerId: string }
  | { type: 'clearSlot'; slotId: string }
  | { type: 'swapSlots'; from: string; to: string }
  | { type: 'removePlayer'; playerId: string }
  | { type: 'changeFormation'; formationId: string; players: readonly Player[] }
  | { type: 'renameLineup'; name: string }
  | { type: 'setKitMode'; kitMode: KitMode }
  | { type: 'applyKitPreset'; presetId: string }
  | { type: 'setCustomKitColor'; key: keyof Omit<Kit, 'pattern'>; value: string }
  | { type: 'setCustomKitPattern'; pattern: Kit['pattern'] }
  | { type: 'clearLineup' }
  | { type: 'newLineup' }
  | { type: 'loadLineup'; lineup: Lineup }
  | { type: 'markSaved'; lineup: Lineup }
  | { type: 'dismissRemapNotice' };

export function createEmptyEditorState(formationId: string = DEFAULT_FORMATION_ID): EditorState {
  return {
    savedId: null,
    name: '',
    formationId,
    assignments: {},
    kitMode: 'club',
    customKit: DEFAULT_CUSTOM_KIT,
    dirty: false,
    lastRemapped: null,
  };
}

/** Every edit marks the lineup dirty; save and load reset that flag. */
function edit(state: EditorState, patch: Partial<EditorState>): EditorState {
  return { ...state, ...patch, dirty: true };
}

export function lineupReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'assignPlayer': {
      const { slotId, playerId } = action;
      if (!hasSlot(state.formationId, slotId)) return state;
      if (state.assignments[slotId] === playerId) return state;

      const assignments = { ...state.assignments };
      const previousSlot = findSlotOf(assignments, playerId);

      if (previousSlot === slotId) return state;

      if (previousSlot !== undefined) {
        // The player is already on the pitch: move them, swapping with whoever is in the
        // target slot so we never duplicate a player or silently drop one.
        const displaced = assignments[slotId];
        if (displaced === undefined) {
          delete assignments[previousSlot];
        } else {
          assignments[previousSlot] = displaced;
        }
      }

      assignments[slotId] = playerId;
      return edit(state, { assignments });
    }

    case 'clearSlot': {
      if (state.assignments[action.slotId] === undefined) return state;
      const assignments = { ...state.assignments };
      delete assignments[action.slotId];
      return edit(state, { assignments });
    }

    case 'swapSlots': {
      const { from, to } = action;
      if (from === to) return state;
      if (!hasSlot(state.formationId, from) || !hasSlot(state.formationId, to)) return state;

      const fromPlayer = state.assignments[from];
      const toPlayer = state.assignments[to];
      if (fromPlayer === undefined && toPlayer === undefined) return state;

      const assignments = { ...state.assignments };
      if (toPlayer === undefined) {
        delete assignments[from];
      } else {
        assignments[from] = toPlayer;
      }
      if (fromPlayer === undefined) {
        delete assignments[to];
      } else {
        assignments[to] = fromPlayer;
      }
      return edit(state, { assignments });
    }

    case 'removePlayer': {
      const slotId = findSlotOf(state.assignments, action.playerId);
      if (slotId === undefined) return state;
      const assignments = { ...state.assignments };
      delete assignments[slotId];
      return edit(state, { assignments });
    }

    case 'changeFormation': {
      if (action.formationId === state.formationId) return state;

      const { assignments, droppedPlayerIds } = remapAssignments(
        state.assignments,
        state.formationId,
        action.formationId,
        action.players,
      );

      return edit(state, {
        formationId: action.formationId,
        assignments,
        lastRemapped: droppedPlayerIds.length > 0 ? { droppedPlayerIds } : null,
      });
    }

    case 'renameLineup':
      if (action.name === state.name) return state;
      return edit(state, { name: action.name });

    case 'setKitMode':
      if (action.kitMode === state.kitMode) return state;
      return edit(state, { kitMode: action.kitMode });

    case 'applyKitPreset': {
      const preset = findKitPreset(action.presetId);
      if (!preset) return state;
      // Choosing a preset is an explicit request for a team-wide kit.
      return edit(state, { customKit: preset.kit, kitMode: 'custom' });
    }

    case 'setCustomKitColor':
      return edit(state, {
        customKit: { ...state.customKit, [action.key]: action.value },
        kitMode: 'custom',
      });

    case 'setCustomKitPattern':
      return edit(state, {
        customKit: { ...state.customKit, pattern: action.pattern },
        kitMode: 'custom',
      });

    case 'clearLineup':
      if (Object.keys(state.assignments).length === 0) return state;
      return edit(state, { assignments: {}, lastRemapped: null });

    /** Start over, keeping the formation the user is already looking at. */
    case 'newLineup':
      return createEmptyEditorState(state.formationId);

    case 'loadLineup': {
      const { lineup } = action;
      return {
        savedId: lineup.id,
        name: lineup.name,
        formationId: lineup.formationId,
        assignments: { ...lineup.assignments },
        kitMode: lineup.kitMode,
        customKit: lineup.customKit ?? DEFAULT_CUSTOM_KIT,
        dirty: false,
        lastRemapped: null,
      };
    }

    case 'markSaved':
      return { ...state, savedId: action.lineup.id, name: action.lineup.name, dirty: false };

    case 'dismissRemapNotice':
      if (!state.lastRemapped) return state;
      return { ...state, lastRemapped: null };

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function findSlotOf(assignments: Record<string, string>, playerId: string): string | undefined {
  return Object.keys(assignments).find((slotId) => assignments[slotId] === playerId);
}

/** Guards against building state the server would reject, e.g. an 'lm' slot in 4-3-3. */
function hasSlot(formationId: string, slotId: string): boolean {
  return getFormation(formationId).slots.some((slot) => slot.id === slotId);
}

export interface RemapResult {
  assignments: Record<string, string>;
  /** Players who had no suitable slot in the new formation and returned to the pool. */
  droppedPlayerIds: string[];
}

/**
 * Carries players across a formation change.
 *
 * Three passes, each locking in the best available match before the next runs:
 *   1. the same slot id exists in the new formation (e.g. 'cb1' -> 'cb1')
 *   2. the player is listed for the new slot's exact role
 *   3. the player covers the slot's role group (a CM filling a CDM slot)
 *
 * Anything still unplaced is returned to the pool and reported, rather than being
 * dropped silently.
 */
export function remapAssignments(
  assignments: Record<string, string>,
  fromFormationId: string,
  toFormationId: string,
  players: readonly Player[],
): RemapResult {
  const target = getFormation(toFormationId);
  const source = getFormation(fromFormationId);
  const playersById = new Map(players.map((p) => [p.id, p]));

  const openSlots = new Map(target.slots.map((slot) => [slot.id, slot]));
  const next: Record<string, string> = {};

  // Preserve the on-pitch order of the previous formation so remapping is deterministic
  // rather than dependent on object key order.
  const pending = source.slots
    .filter((slot) => assignments[slot.id] !== undefined)
    .map((slot) => ({ previousSlotId: slot.id, playerId: assignments[slot.id]! }));

  // Pass 1: identical slot id.
  for (const entry of [...pending]) {
    if (openSlots.has(entry.previousSlotId)) {
      next[entry.previousSlotId] = entry.playerId;
      openSlots.delete(entry.previousSlotId);
      pending.splice(pending.indexOf(entry), 1);
    }
  }

  // Passes 2 and 3: exact role, then role group.
  for (const matches of [playsRole, playsRoleGroup]) {
    for (const entry of [...pending]) {
      const player = playersById.get(entry.playerId);
      if (!player) continue;

      const slot = [...openSlots.values()].find((candidate) =>
        matches(player.roles, candidate.role),
      );
      if (slot) {
        next[slot.id] = entry.playerId;
        openSlots.delete(slot.id);
        pending.splice(pending.indexOf(entry), 1);
      }
    }
  }

  return { assignments: next, droppedPlayerIds: pending.map((entry) => entry.playerId) };
}

/** Convenience selectors used by the UI. */

export function assignedPlayerIds(state: Pick<EditorState, 'assignments'>): Set<string> {
  return new Set(Object.values(state.assignments));
}

export function isComplete(state: Pick<EditorState, 'formationId' | 'assignments'>): boolean {
  return Object.keys(state.assignments).length === getFormation(state.formationId).slots.length;
}

export function toLineupInput(state: EditorState) {
  return {
    name: state.name.trim(),
    formationId: state.formationId,
    assignments: state.assignments,
    kitMode: state.kitMode,
    // Only send a custom kit when it is actually in use, so club-kit lineups stay clean.
    customKit: state.kitMode === 'custom' ? state.customKit : null,
  };
}
