import * as Dialog from '@radix-ui/react-dialog';
import { useMemo, useState } from 'react';
import { searchPlayers } from '../../data/index';
import { resolveKit } from '../../shared/kits';
import type { Club, FormationSlot, Kit, KitMode, Player } from '../../shared/types';
import { Jersey } from './Jersey';

interface PlayerSearchModalProps {
  /** The slot being filled; null closes the modal. */
  slot: FormationSlot | null;
  players: readonly Player[];
  clubsById: ReadonlyMap<string, Club>;
  /** Players already on the pitch, so the list can mark them as in use. */
  assignedPlayerIds: ReadonlySet<string>;
  kitMode: KitMode;
  customKit: Kit;
  onSelect: (playerId: string) => void;
  onClose: () => void;
}

const MAX_RESULTS = 60;

/**
 * Opened by clicking a position. Results start filtered to players who can play that
 * position; the toggle widens the search to the whole catalog.
 */
export function PlayerSearchModal({
  slot,
  players,
  clubsById,
  assignedPlayerIds,
  kitMode,
  customKit,
  onSelect,
  onClose,
}: PlayerSearchModalProps) {
  const [query, setQuery] = useState('');
  const [allPositions, setAllPositions] = useState(false);

  const results = useMemo(() => {
    if (!slot) return [];
    return searchPlayers(
      { q: query, role: allPositions ? undefined : slot.role, limit: MAX_RESULTS },
      players,
    );
  }, [slot, query, allPositions, players]);

  // Reset the form each time the modal opens for a different slot.
  const reset = () => {
    setQuery('');
    setAllPositions(false);
  };

  return (
    <Dialog.Root
      open={slot !== null}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal" aria-describedby={undefined}>
          <Dialog.Title className="modal-title">
            {slot ? `Pick a player for ${slot.label}` : 'Pick a player'}
          </Dialog.Title>

          <div className="modal-controls">
            <input
              type="search"
              className="modal-search"
              placeholder="Search by player or club"
              aria-label="Search by player or club"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
            <label className="modal-toggle">
              <input
                type="checkbox"
                checked={allPositions}
                onChange={(event) => setAllPositions(event.target.checked)}
              />
              Show all positions
            </label>
          </div>

          {results.length === 0 ? (
            <p className="modal-empty" role="status" data-testid="search-empty">
              No players match. Try a different search{allPositions ? '' : ' or show all positions'}
              .
            </p>
          ) : (
            <ul className="modal-results" aria-label="Search results">
              {results.map((player) => {
                const club = clubsById.get(player.clubId);
                const inUse = assignedPlayerIds.has(player.id);

                return (
                  <li key={player.id}>
                    <button
                      type="button"
                      className="result"
                      data-testid={`result-${player.id}`}
                      data-in-use={inUse ? 'true' : 'false'}
                      onClick={() => {
                        reset();
                        onSelect(player.id);
                      }}
                    >
                      <Jersey
                        kit={resolveKit(player, { kitMode, customKit }, clubsById)}
                        number={player.number}
                        size={30}
                        title={`${player.name} shirt`}
                      />
                      <span className="result-name">{player.name}</span>
                      <span className="result-club">{club?.name ?? 'Unknown club'}</span>
                      <span className="result-roles">{player.roles.join(' / ')}</span>
                      {inUse ? <span className="result-badge">In lineup</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <Dialog.Close asChild>
            <button type="button" className="modal-close" aria-label="Close">
              Cancel
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
