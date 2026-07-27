import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Club, FormationSlot, Kit, Player } from '../../shared/types';
import { Jersey } from './Jersey';

export interface PositionSlotProps {
  slot: FormationSlot;
  player: Player | undefined;
  club: Club | undefined;
  kit: Kit;
  onOpenSearch: (slotId: string) => void;
  onClear: (slotId: string) => void;
}

/**
 * One spot on the pitch. Always a drop target; when filled it also exposes a drag handle
 * so two players can be swapped by dragging one onto the other.
 *
 * The handle is deliberately separate from the main button: sharing one element would make
 * Space and Enter both open the search modal and start a keyboard drag.
 */
export function PositionSlot({
  slot,
  player,
  club,
  kit,
  onOpenSearch,
  onClear,
}: PositionSlotProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot:${slot.id}`,
    data: { type: 'slot', slotId: slot.id },
  });

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `pitch:${slot.id}`,
    disabled: !player, // an empty slot has nothing to pick up
    data: { type: 'pitch', slotId: slot.id, playerId: player?.id },
  });

  return (
    <div
      className="slot"
      style={{ left: `${slot.x}%`, bottom: `${slot.y}%` }}
      data-testid={`slot-${slot.id}`}
      data-slot-id={slot.id}
      data-role={slot.role}
      data-filled={player ? 'true' : 'false'}
      data-over={isOver ? 'true' : 'false'}
      data-dragging={isDragging ? 'true' : 'false'}
    >
      <div ref={setDropRef} className="slot-drop">
        <button
          type="button"
          className="slot-button"
          aria-label={
            player
              ? `${player.name}, ${slot.label}. Change player`
              : `Empty ${slot.label}. Add a player`
          }
          onClick={() => onOpenSearch(slot.id)}
        >
          {player ? (
            <Jersey kit={kit} number={player.number} title={`${player.name} shirt`} />
          ) : (
            <span className="slot-empty" aria-hidden="true">
              +
            </span>
          )}
          <span className="slot-name">{player ? lastName(player.name) : slot.label}</span>
          {player && club ? <span className="slot-club">{club.shortName}</span> : null}
        </button>

        {player ? (
          <>
            <button
              ref={setDragRef}
              type="button"
              className="slot-handle"
              aria-label={`Move ${player.name}`}
              data-testid={`drag-${slot.id}`}
              {...attributes}
              {...listeners}
            >
              <span aria-hidden="true">⠿</span>
            </button>
            <button
              type="button"
              className="slot-clear"
              aria-label={`Remove ${player.name} from ${slot.label}`}
              onClick={() => onClear(slot.id)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** "Kylian Mbappe" -> "Mbappe", so names fit inside a slot. */
export function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
}
