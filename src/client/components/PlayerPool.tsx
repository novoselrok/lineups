import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { searchPlayers } from '../../data/index';
import { resolveKit } from '../../shared/kits';
import type { Club, Kit, KitMode, Player } from '../../shared/types';
import { Jersey } from './Jersey';

interface PlayerPoolProps {
  players: readonly Player[];
  clubsById: ReadonlyMap<string, Club>;
  assignedPlayerIds: ReadonlySet<string>;
  kitMode: KitMode;
  customKit: Kit;
}

const POOL_LIMIT = 40;

/**
 * The bench: every player not currently on the pitch. Cards are drag sources, and the
 * pool itself is a drop target so a player can be dragged off the pitch to unassign them.
 */
export function PlayerPool({
  players,
  clubsById,
  assignedPlayerIds,
  kitMode,
  customKit,
}: PlayerPoolProps) {
  const [query, setQuery] = useState('');
  const [clubId, setClubId] = useState('');

  const { setNodeRef, isOver } = useDroppable({ id: 'pool', data: { type: 'pool' } });

  const available = useMemo(
    () =>
      searchPlayers(
        { q: query, clubId: clubId || undefined, limit: POOL_LIMIT },
        players.filter((player) => !assignedPlayerIds.has(player.id)),
      ),
    [players, assignedPlayerIds, query, clubId],
  );

  const clubs = useMemo(
    () => [...clubsById.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [clubsById],
  );

  return (
    <section
      className="panel pool"
      aria-label="Available players"
      ref={setNodeRef}
      data-over={isOver ? 'true' : 'false'}
      data-testid="player-pool"
    >
      <h2 className="panel-title">Players</h2>
      <p className="panel-hint">Drag onto a position, or drop here to take a player off.</p>

      <div className="pool-filters">
        <input
          type="search"
          placeholder="Search players"
          aria-label="Search available players"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filter by club"
          value={clubId}
          onChange={(event) => setClubId(event.target.value)}
        >
          <option value="">All clubs</option>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </div>

      {available.length === 0 ? (
        <p className="panel-empty" role="status">
          No available players match that search.
        </p>
      ) : (
        <ul className="pool-list">
          {available.map((player) => (
            <PoolCard
              key={player.id}
              player={player}
              club={clubsById.get(player.clubId)}
              kit={resolveKit(player, { kitMode, customKit }, clubsById)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PoolCard({ player, club, kit }: { player: Player; club: Club | undefined; kit: Kit }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${player.id}`,
    data: { type: 'pool-player', playerId: player.id },
  });

  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        className="pool-card"
        data-testid={`pool-${player.id}`}
        data-dragging={isDragging ? 'true' : 'false'}
        aria-label={`${player.name}, ${player.roles.join(' or ')}, ${club?.name ?? 'unknown club'}. Drag onto a position`}
        {...attributes}
        {...listeners}
      >
        <Jersey kit={kit} number={player.number} size={30} title={`${player.name} shirt`} />
        <span className="pool-name">{player.name}</span>
        <span className="pool-meta">
          {club?.shortName ?? '—'} · {player.roles.join('/')}
        </span>
      </button>
    </li>
  );
}
