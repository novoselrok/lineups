import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { CATALOG } from '../data/index';
import { DEFAULT_FORMATION_ID, getFormation } from '../shared/formations';
import { clubsToMap, resolveKit } from '../shared/kits';
import type { LineupSummary, Player } from '../shared/types';
import { ApiError, api } from './api';
import { Jersey } from './components/Jersey';
import { KitPanel } from './components/KitPanel';
import { LineupToolbar } from './components/LineupToolbar';
import { Pitch } from './components/Pitch';
import { PlayerPool } from './components/PlayerPool';
import { PlayerSearchModal } from './components/PlayerSearchModal';
import {
  assignedPlayerIds as selectAssignedIds,
  createEmptyEditorState,
  lineupReducer,
  toLineupInput,
} from './state/lineupReducer';

/** What is currently being dragged, used to render the overlay. */
type ActiveDrag = { playerId: string; fromSlotId?: string } | null;

/**
 * Prefer whatever is under the pointer. Plain `closestCenter` measures centre-to-centre,
 * which lets a nearby position steal a drop aimed at the large player pool. Keyboard drags
 * have no pointer, so they fall back to `closestCenter`.
 */
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : closestCenter(args);
};

export function App() {
  const [state, dispatch] = useReducer(lineupReducer, undefined, () =>
    createEmptyEditorState(DEFAULT_FORMATION_ID),
  );
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null);
  const [saved, setSaved] = useState<LineupSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playersById = useMemo(() => new Map(CATALOG.players.map((p) => [p.id, p])), []);
  const clubsById = useMemo(() => clubsToMap(CATALOG.clubs), []);
  const formation = getFormation(state.formationId);
  const assignedIds = useMemo(() => selectAssignedIds(state), [state]);

  const refreshSaved = useCallback(async () => {
    try {
      setSaved(await api.listLineups());
    } catch {
      // A failed list should not block editing; the save button still reports errors.
      setSaved([]);
    }
  }, []);

  // Load the saved list once on mount, ignoring the response if we unmount first.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await api.listLineups();
        if (active) setSaved(list);
      } catch {
        if (active) setSaved([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // A click must not start a drag, so the pointer sensor waits for a short movement.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'pool-player') {
      setActiveDrag({ playerId: data.playerId as string });
    } else if (data?.type === 'pitch' && data.playerId) {
      setActiveDrag({ playerId: data.playerId as string, fromSlotId: data.slotId as string });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const active = event.active.data.current;
    const over = event.over?.data.current;
    if (!active || !over) return;

    // Pool -> slot: assign (replacing whoever was there).
    if (active.type === 'pool-player' && over.type === 'slot') {
      dispatch({
        type: 'assignPlayer',
        slotId: over.slotId as string,
        playerId: active.playerId as string,
      });
      return;
    }

    // Pitch -> slot: swap the two positions.
    if (active.type === 'pitch' && over.type === 'slot') {
      dispatch({ type: 'swapSlots', from: active.slotId as string, to: over.slotId as string });
      return;
    }

    // Pitch -> pool: take the player off.
    if (active.type === 'pitch' && over.type === 'pool' && active.playerId) {
      dispatch({ type: 'removePlayer', playerId: active.playerId as string });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = toLineupInput(state);
      const lineup = state.savedId
        ? await api.updateLineup(state.savedId, payload)
        : await api.createLineup(payload);
      dispatch({ type: 'markSaved', lineup });
      await refreshSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? [caught.message, ...caught.issues.map((i) => `${i.path}: ${i.message}`)].join(' — ')
          : 'Could not save the lineup. Is the server running?',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (id: string) => {
    setError(null);
    try {
      dispatch({ type: 'loadLineup', lineup: await api.getLineup(id) });
    } catch {
      setError('Could not load that lineup.');
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await api.deleteLineup(id);
      if (state.savedId === id) dispatch({ type: 'clearLineup' });
      await refreshSaved();
    } catch {
      setError('Could not delete that lineup.');
    }
  };

  const activePlayer: Player | undefined = activeDrag
    ? playersById.get(activeDrag.playerId)
    : undefined;

  const droppedNames =
    state.lastRemapped?.droppedPlayerIds.map((id) => playersById.get(id)?.name ?? id).join(', ') ??
    '';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="app">
        <LineupToolbar
          name={state.name}
          formationId={state.formationId}
          filledCount={Object.keys(state.assignments).length}
          slotCount={formation.slots.length}
          dirty={state.dirty}
          saving={saving}
          saved={saved}
          currentSavedId={state.savedId}
          onNameChange={(name) => dispatch({ type: 'renameLineup', name })}
          onFormationChange={(formationId) =>
            dispatch({ type: 'changeFormation', formationId, players: CATALOG.players })
          }
          onSave={() => void handleSave()}
          onNew={() => dispatch({ type: 'newLineup' })}
          onLoad={(id) => void handleLoad(id)}
          onDelete={(id) => void handleDelete(id)}
        />

        {error ? (
          <p className="banner banner-error" role="alert">
            {error}
          </p>
        ) : null}

        {state.lastRemapped ? (
          <p className="banner banner-notice" role="status" data-testid="remap-notice">
            {droppedNames} had no matching position in {formation.name} and returned to the player
            list.{' '}
            <button type="button" onClick={() => dispatch({ type: 'dismissRemapNotice' })}>
              Dismiss
            </button>
          </p>
        ) : null}

        <main className="layout">
          <Pitch
            formation={formation}
            assignments={state.assignments}
            playersById={playersById}
            clubsById={clubsById}
            kitMode={state.kitMode}
            customKit={state.customKit}
            onOpenSearch={setOpenSlotId}
            onClear={(slotId) => dispatch({ type: 'clearSlot', slotId })}
          />

          {/* The pool comes first: it is needed constantly while filling positions,
              and it must stay visible alongside the pitch for dragging to work. */}
          <aside className="sidebar">
            <PlayerPool
              players={CATALOG.players}
              clubsById={clubsById}
              assignedPlayerIds={assignedIds}
              kitMode={state.kitMode}
              customKit={state.customKit}
            />

            <KitPanel
              kitMode={state.kitMode}
              customKit={state.customKit}
              onKitModeChange={(kitMode) => dispatch({ type: 'setKitMode', kitMode })}
              onApplyPreset={(presetId) => dispatch({ type: 'applyKitPreset', presetId })}
              onColorChange={(key, value) => dispatch({ type: 'setCustomKitColor', key, value })}
              onPatternChange={(pattern) => dispatch({ type: 'setCustomKitPattern', pattern })}
            />
          </aside>
        </main>

        <PlayerSearchModal
          slot={openSlotId ? (formation.slots.find((s) => s.id === openSlotId) ?? null) : null}
          players={CATALOG.players}
          clubsById={clubsById}
          assignedPlayerIds={assignedIds}
          kitMode={state.kitMode}
          customKit={state.customKit}
          onSelect={(playerId) => {
            if (openSlotId) dispatch({ type: 'assignPlayer', slotId: openSlotId, playerId });
            setOpenSlotId(null);
          }}
          onClose={() => setOpenSlotId(null)}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activePlayer ? (
          <div className="drag-preview">
            <Jersey
              kit={resolveKit(activePlayer, state, clubsById)}
              number={activePlayer.number}
              size={44}
            />
            <span>{activePlayer.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
