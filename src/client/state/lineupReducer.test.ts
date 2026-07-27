import { describe, expect, it } from 'vitest';
import { PLAYERS } from '../../data/index';
import { getFormation } from '../../shared/formations';
import { KIT_PRESETS } from '../../shared/kits';
import type { Lineup } from '../../shared/types';
import {
  createEmptyEditorState,
  isComplete,
  lineupReducer,
  remapAssignments,
  toLineupInput,
  type EditorAction,
  type EditorState,
} from './lineupReducer';

function reduce(state: EditorState, ...actions: EditorAction[]): EditorState {
  return actions.reduce(lineupReducer, state);
}

const base = createEmptyEditorState('4-3-3');

const assign = (slotId: string, playerId: string): EditorAction => ({
  type: 'assignPlayer',
  slotId,
  playerId,
});

describe('assignPlayer', () => {
  it('puts a player into an empty slot', () => {
    const next = reduce(base, assign('gk', 'liv-alisson'));
    expect(next.assignments).toEqual({ gk: 'liv-alisson' });
    expect(next.dirty).toBe(true);
  });

  it('replaces whoever was in the slot when the new player comes from the pool', () => {
    const next = reduce(base, assign('gk', 'liv-alisson'), assign('gk', 'bay-neuer'));
    expect(next.assignments).toEqual({ gk: 'bay-neuer' });
  });

  it('never lists the same player in two slots', () => {
    const next = reduce(base, assign('st1', 'mci-haaland'), assign('lw', 'mci-haaland'));
    expect(next.assignments).toEqual({ lw: 'mci-haaland' });
  });

  it('moves an on-pitch player to an empty slot, vacating the old one', () => {
    const next = reduce(base, assign('lw', 'rma-vinicius'), assign('rw', 'rma-vinicius'));
    expect(next.assignments).toEqual({ rw: 'rma-vinicius' });
    expect(next.assignments.lw).toBeUndefined();
  });

  it('sends the occupant back to the pool when an on-pitch player is moved onto their slot', () => {
    const next = reduce(
      base,
      assign('lw', 'rma-vinicius'),
      assign('rw', 'liv-salah'),
      assign('rw', 'rma-vinicius'),
    );
    expect(next.assignments).toEqual({ rw: 'rma-vinicius' });
  });

  it('is a no-op when the player is already in that slot', () => {
    const once = reduce(base, assign('gk', 'liv-alisson'));
    expect(lineupReducer(once, assign('gk', 'liv-alisson'))).toBe(once);
  });

  it('does not mutate the previous state', () => {
    const before = reduce(base, assign('gk', 'liv-alisson'));
    const snapshot = { ...before.assignments };
    reduce(before, assign('st1', 'mci-haaland'));
    expect(before.assignments).toEqual(snapshot);
  });
});

describe('clearSlot', () => {
  it('empties an occupied slot', () => {
    const next = reduce(base, assign('gk', 'liv-alisson'), { type: 'clearSlot', slotId: 'gk' });
    expect(next.assignments).toEqual({});
  });

  it('is a no-op for an already empty slot', () => {
    expect(lineupReducer(base, { type: 'clearSlot', slotId: 'gk' })).toBe(base);
  });
});

describe('removePlayer', () => {
  it('takes a player off the pitch wherever they are', () => {
    const next = reduce(base, assign('st1', 'mci-haaland'), {
      type: 'removePlayer',
      playerId: 'mci-haaland',
    });
    expect(next.assignments).toEqual({});
  });

  it('is a no-op for a player who is not on the pitch', () => {
    expect(lineupReducer(base, { type: 'removePlayer', playerId: 'nobody' })).toBe(base);
  });
});

describe('swapSlots', () => {
  it('exchanges two occupied slots', () => {
    const next = reduce(base, assign('cb1', 'liv-vandijk'), assign('cb2', 'rma-rudiger'), {
      type: 'swapSlots',
      from: 'cb1',
      to: 'cb2',
    });
    expect(next.assignments).toEqual({ cb1: 'rma-rudiger', cb2: 'liv-vandijk' });
  });

  it('moves a player when the target slot is empty', () => {
    const next = reduce(base, assign('cb1', 'liv-vandijk'), {
      type: 'swapSlots',
      from: 'cb1',
      to: 'cb2',
    });
    expect(next.assignments).toEqual({ cb2: 'liv-vandijk' });
  });

  it('moves a player when the source slot is empty', () => {
    const next = reduce(base, assign('cb2', 'liv-vandijk'), {
      type: 'swapSlots',
      from: 'cb1',
      to: 'cb2',
    });
    expect(next.assignments).toEqual({ cb1: 'liv-vandijk' });
  });

  it('is a no-op when both slots are empty', () => {
    expect(lineupReducer(base, { type: 'swapSlots', from: 'cb1', to: 'cb2' })).toBe(base);
  });

  it('is a no-op when swapping a slot with itself', () => {
    const once = reduce(base, assign('cb1', 'liv-vandijk'));
    expect(lineupReducer(once, { type: 'swapSlots', from: 'cb1', to: 'cb1' })).toBe(once);
  });
});

describe('changeFormation', () => {
  const changeTo = (formationId: string): EditorAction => ({
    type: 'changeFormation',
    formationId,
    players: PLAYERS,
  });

  it('keeps players whose slot exists in the new formation', () => {
    const next = reduce(
      base,
      assign('gk', 'liv-alisson'),
      assign('cb1', 'liv-vandijk'),
      changeTo('4-4-2'),
    );
    expect(next.formationId).toBe('4-4-2');
    expect(next.assignments.gk).toBe('liv-alisson');
    expect(next.assignments.cb1).toBe('liv-vandijk');
  });

  it('re-seats a player into a different slot of the same role', () => {
    // 4-3-3 has one 'cdm'; 4-2-3-1 has 'cdm1'/'cdm2' instead.
    const next = reduce(base, assign('cdm', 'mci-rodri'), changeTo('4-2-3-1'));
    expect(Object.values(next.assignments)).toContain('mci-rodri');
    expect(next.assignments.cdm).toBeUndefined();
  });

  it('falls back to the role group when no exact role slot is free', () => {
    // A pure LW moving to 4-4-2, which has no winger slots — LM is the same group.
    const next = reduce(base, assign('lw', 'mci-doku'), changeTo('4-4-2'));
    expect(Object.values(next.assignments)).toContain('mci-doku');
  });

  it('accounts for every player after a change, either seated or reported as dropped', () => {
    // 3-4-3 fields three forwards; 4-1-4-1 has a single striker slot, so the other two
    // must move into midfield or come off — but none may vanish unreported.
    const crowded = reduce(
      createEmptyEditorState('3-4-3'),
      assign('lw', 'mci-doku'),
      assign('rw', 'liv-salah'),
      assign('st1', 'mci-haaland'),
      changeTo('4-1-4-1'),
    );

    expect(crowded.formationId).toBe('4-1-4-1');
    const seated = Object.values(crowded.assignments);
    const dropped = crowded.lastRemapped?.droppedPlayerIds ?? [];
    expect(seated.length + dropped.length).toBe(3);
    expect([...seated, ...dropped].sort()).toEqual(['mci-doku', 'liv-salah', 'mci-haaland'].sort());
  });

  it('ignores an assignment to a slot the current formation does not have', () => {
    // 4-3-3 has no 'lm' slot; accepting it would build state the server rejects.
    expect(lineupReducer(base, assign('lm', 'bay-coman'))).toBe(base);
  });

  it('ignores a swap involving a slot the current formation does not have', () => {
    const once = reduce(base, assign('cb1', 'liv-vandijk'));
    expect(lineupReducer(once, { type: 'swapSlots', from: 'cb1', to: 'lwb' })).toBe(once);
  });

  it('clears the remap notice when everything fits', () => {
    const next = reduce(base, assign('gk', 'liv-alisson'), changeTo('4-4-2'));
    expect(next.lastRemapped).toBeNull();
  });

  it('is a no-op when the formation is unchanged', () => {
    const once = reduce(base, assign('gk', 'liv-alisson'));
    expect(lineupReducer(once, changeTo('4-3-3'))).toBe(once);
  });

  it('never assigns a player to two slots after remapping', () => {
    const eleven = getFormation('4-3-3').slots.map((slot, i) => {
      const player = PLAYERS.filter((p) => p.roles.includes(slot.role))[i % 3];
      return assign(slot.id, player!.id);
    });
    const filled = reduce(base, ...eleven);

    for (const formationId of ['4-4-2', '3-5-2', '5-3-2', '4-2-3-1', '3-4-3', '4-1-4-1']) {
      const next = lineupReducer(filled, {
        type: 'changeFormation',
        formationId,
        players: PLAYERS,
      });
      const ids = Object.values(next.assignments);
      expect(new Set(ids).size, `${formationId} duplicated a player`).toBe(ids.length);
    }
  });

  it('never assigns more players than the formation has slots', () => {
    const eleven = getFormation('4-3-3').slots.map((slot, i) => {
      const player = PLAYERS.filter((p) => p.roles.includes(slot.role))[i % 3];
      return assign(slot.id, player!.id);
    });
    const filled = reduce(base, ...eleven);

    for (const formationId of ['4-4-2', '3-5-2', '5-3-2']) {
      const next = lineupReducer(filled, {
        type: 'changeFormation',
        formationId,
        players: PLAYERS,
      });
      expect(Object.keys(next.assignments).length).toBeLessThanOrEqual(11);
    }
  });

  it('only uses slot ids that belong to the new formation', () => {
    const filled = reduce(base, assign('gk', 'liv-alisson'), assign('lw', 'mci-doku'));
    const next = lineupReducer(filled, {
      type: 'changeFormation',
      formationId: '5-3-2',
      players: PLAYERS,
    });
    const valid = new Set(getFormation('5-3-2').slots.map((s) => s.id));
    for (const slotId of Object.keys(next.assignments)) {
      expect(valid.has(slotId), `${slotId} is not a 5-3-2 slot`).toBe(true);
    }
  });
});

describe('remapAssignments', () => {
  it('keeps a goalkeeper in goal across every formation', () => {
    for (const formationId of ['4-4-2', '3-5-2', '5-3-2', '4-2-3-1', '3-4-3', '4-1-4-1']) {
      const result = remapAssignments({ gk: 'liv-alisson' }, '4-3-3', formationId, PLAYERS);
      expect(result.assignments.gk, formationId).toBe('liv-alisson');
      expect(result.droppedPlayerIds).toEqual([]);
    }
  });

  it('ignores players missing from the catalog rather than throwing', () => {
    const result = remapAssignments({ cdm: 'ghost-player' }, '4-3-3', '4-4-2', PLAYERS);
    expect(result.assignments).toEqual({});
    expect(result.droppedPlayerIds).toEqual(['ghost-player']);
  });

  it('is deterministic', () => {
    const assignments = {
      gk: 'liv-alisson',
      cb1: 'liv-vandijk',
      lw: 'mci-doku',
      st1: 'mci-haaland',
    };
    const a = remapAssignments(assignments, '4-3-3', '3-5-2', PLAYERS);
    const b = remapAssignments(assignments, '4-3-3', '3-5-2', PLAYERS);
    expect(a).toEqual(b);
  });
});

describe('naming', () => {
  it('records the name and marks the lineup dirty', () => {
    const next = lineupReducer(base, { type: 'renameLineup', name: 'My Best XI' });
    expect(next.name).toBe('My Best XI');
    expect(next.dirty).toBe(true);
  });

  it('is a no-op when the name is unchanged', () => {
    const named = lineupReducer(base, { type: 'renameLineup', name: 'Same' });
    expect(lineupReducer(named, { type: 'renameLineup', name: 'Same' })).toBe(named);
  });
});

describe('kit actions', () => {
  it('switches to a custom kit and back to club kits', () => {
    const custom = lineupReducer(base, { type: 'setKitMode', kitMode: 'custom' });
    expect(custom.kitMode).toBe('custom');

    const back = lineupReducer(custom, { type: 'setKitMode', kitMode: 'club' });
    expect(back.kitMode).toBe('club');
  });

  it('applying a preset also turns the custom kit on', () => {
    const preset = KIT_PRESETS[2]!;
    const next = lineupReducer(base, { type: 'applyKitPreset', presetId: preset.id });
    expect(next.kitMode).toBe('custom');
    expect(next.customKit).toEqual(preset.kit);
  });

  it('ignores an unknown preset id', () => {
    expect(lineupReducer(base, { type: 'applyKitPreset', presetId: 'nope' })).toBe(base);
  });

  it('editing a single colour keeps the other colours', () => {
    const next = lineupReducer(base, {
      type: 'setCustomKitColor',
      key: 'shirt',
      value: '#123456',
    });
    expect(next.customKit.shirt).toBe('#123456');
    expect(next.customKit.shorts).toBe(base.customKit.shorts);
    expect(next.kitMode).toBe('custom');
  });

  it('changing the pattern keeps the colours', () => {
    const next = lineupReducer(base, { type: 'setCustomKitPattern', pattern: 'stripes' });
    expect(next.customKit.pattern).toBe('stripes');
    expect(next.customKit.shirt).toBe(base.customKit.shirt);
  });
});

describe('load, save and clear', () => {
  const saved: Lineup = {
    id: 'saved-1',
    name: 'Saved XI',
    formationId: '3-5-2',
    assignments: { gk: 'bay-neuer', st1: 'bay-kane' },
    kitMode: 'custom',
    customKit: KIT_PRESETS[1]!.kit,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('loads a saved lineup as clean state', () => {
    const next = lineupReducer(base, { type: 'loadLineup', lineup: saved });
    expect(next).toMatchObject({
      savedId: 'saved-1',
      name: 'Saved XI',
      formationId: '3-5-2',
      kitMode: 'custom',
      dirty: false,
    });
    expect(next.assignments).toEqual(saved.assignments);
  });

  it('copies assignments so later edits do not mutate the loaded lineup', () => {
    const loaded = lineupReducer(base, { type: 'loadLineup', lineup: saved });
    reduce(loaded, assign('st2', 'int-lautaro'));
    expect(saved.assignments).toEqual({ gk: 'bay-neuer', st1: 'bay-kane' });
  });

  it('falls back to the default custom kit when a saved lineup has none', () => {
    const next = lineupReducer(base, {
      type: 'loadLineup',
      lineup: { ...saved, kitMode: 'club', customKit: null },
    });
    expect(next.customKit).toEqual(base.customKit);
  });

  it('marking saved clears the dirty flag and records the id', () => {
    const dirty = reduce(base, assign('gk', 'liv-alisson'));
    const next = lineupReducer(dirty, { type: 'markSaved', lineup: saved });
    expect(next.dirty).toBe(false);
    expect(next.savedId).toBe('saved-1');
  });

  it('clears the pitch but keeps the formation and name', () => {
    const filled = reduce(
      base,
      { type: 'renameLineup', name: 'Keep' },
      assign('gk', 'liv-alisson'),
    );
    const next = lineupReducer(filled, { type: 'clearLineup' });
    expect(next.assignments).toEqual({});
    expect(next.name).toBe('Keep');
    expect(next.formationId).toBe('4-3-3');
  });

  it('clearing an empty pitch is a no-op', () => {
    expect(lineupReducer(base, { type: 'clearLineup' })).toBe(base);
  });

  it('dismisses the remap notice', () => {
    const withNotice: EditorState = { ...base, lastRemapped: { droppedPlayerIds: ['x'] } };
    expect(lineupReducer(withNotice, { type: 'dismissRemapNotice' }).lastRemapped).toBeNull();
  });
});

describe('selectors', () => {
  it('isComplete only when every slot is filled', () => {
    expect(isComplete(base)).toBe(false);

    const eleven = getFormation('4-3-3').slots.map((slot, i) => {
      const player = PLAYERS.filter((p) => p.roles.includes(slot.role))[i % 3];
      return assign(slot.id, player!.id);
    });
    expect(isComplete(reduce(base, ...eleven))).toBe(true);
  });

  it('toLineupInput trims the name and omits an unused custom kit', () => {
    const state = reduce(base, { type: 'renameLineup', name: '  Spaced  ' });
    const payload = toLineupInput(state);
    expect(payload.name).toBe('Spaced');
    expect(payload.customKit).toBeNull();
  });

  it('toLineupInput includes the custom kit when it is in use', () => {
    const state = lineupReducer(base, { type: 'applyKitPreset', presetId: KIT_PRESETS[0]!.id });
    expect(toLineupInput(state).customKit).toEqual(KIT_PRESETS[0]!.kit);
  });
});
