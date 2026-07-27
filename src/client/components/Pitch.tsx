import { resolveKit } from '../../shared/kits';
import type { Club, Formation, Kit, KitMode, Player } from '../../shared/types';
import { PositionSlot } from './PositionSlot';

interface PitchProps {
  formation: Formation;
  assignments: Record<string, string>;
  playersById: ReadonlyMap<string, Player>;
  clubsById: ReadonlyMap<string, Club>;
  kitMode: KitMode;
  customKit: Kit;
  onOpenSearch: (slotId: string) => void;
  onClear: (slotId: string) => void;
}

export function Pitch({
  formation,
  assignments,
  playersById,
  clubsById,
  kitMode,
  customKit,
  onOpenSearch,
  onClear,
}: PitchProps) {
  return (
    <div className="pitch" data-testid="pitch" aria-label={`${formation.name} pitch`}>
      <div className="pitch-markings" aria-hidden="true">
        <div className="pitch-centre-circle" />
        <div className="pitch-halfway" />
        <div className="pitch-box pitch-box-own" />
        <div className="pitch-box pitch-box-far" />
      </div>

      {formation.slots.map((slot) => {
        const playerId = assignments[slot.id];
        const player = playerId ? playersById.get(playerId) : undefined;
        const club = player ? clubsById.get(player.clubId) : undefined;

        return (
          <PositionSlot
            key={slot.id}
            slot={slot}
            player={player}
            club={club}
            kit={player ? resolveKit(player, { kitMode, customKit }, clubsById) : customKit}
            onOpenSearch={onOpenSearch}
            onClear={onClear}
          />
        );
      })}
    </div>
  );
}
