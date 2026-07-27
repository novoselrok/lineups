import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { findSlot } from '../../shared/formations';
import { KIT_PRESETS } from '../../shared/kits';
import { PlayerSearchModal } from './PlayerSearchModal';
import { PLAYERS, clubsById, renderWithDnd } from '../test/render';

const customKit = KIT_PRESETS[0]!.kit;
const gkSlot = findSlot('4-3-3', 'gk')!;
const stSlot = findSlot('4-3-3', 'st1')!;

function setup(overrides: Partial<Parameters<typeof PlayerSearchModal>[0]> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();

  const view = renderWithDnd(
    <PlayerSearchModal
      slot={gkSlot}
      players={PLAYERS}
      clubsById={clubsById}
      assignedPlayerIds={new Set()}
      kitMode="club"
      customKit={customKit}
      onSelect={onSelect}
      onClose={onClose}
      {...overrides}
    />,
  );

  return { onSelect, onClose, ...view };
}

const results = () => screen.getByRole('list', { name: 'Search results' });
const resultButtons = () => within(results()).getAllByRole('button');

describe('PlayerSearchModal', () => {
  it('renders nothing when no slot is open', () => {
    setup({ slot: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens with the position in the title', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Pick a player for GK')).toBeInTheDocument();
  });

  it('pre-filters to players who can play the position', () => {
    setup();
    const names = resultButtons().map((b) => b.textContent ?? '');
    expect(names.length).toBeGreaterThan(0);
    // Every result must list GK among its positions.
    expect(names.every((text) => text.includes('GK'))).toBe(true);
    // A striker should not be offered for the goalkeeper slot.
    expect(within(results()).queryByText('Erling Haaland')).not.toBeInTheDocument();
  });

  it('pre-filters differently for a different position', () => {
    setup({ slot: stSlot });
    expect(within(results()).getByText('Erling Haaland')).toBeInTheDocument();
    expect(within(results()).queryByText('Alisson')).not.toBeInTheDocument();
  });

  it('filters by player name as you type', async () => {
    const user = userEvent.setup();
    setup({ slot: stSlot });

    await user.type(screen.getByLabelText('Search by player or club'), 'haaland');

    expect(resultButtons()).toHaveLength(1);
    expect(within(results()).getByText('Erling Haaland')).toBeInTheDocument();
  });

  it('filters by club name', async () => {
    const user = userEvent.setup();
    setup({ slot: stSlot });

    await user.type(screen.getByLabelText('Search by player or club'), 'Bayern');

    const names = resultButtons().map((b) => b.textContent ?? '');
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((text) => text.includes('Bayern Munich'))).toBe(true);
  });

  it('is case-insensitive', async () => {
    const user = userEvent.setup();
    setup({ slot: stSlot });

    await user.type(screen.getByLabelText('Search by player or club'), 'HAALAND');
    expect(within(results()).getByText('Erling Haaland')).toBeInTheDocument();
  });

  it('widens the search to every position when asked', async () => {
    const user = userEvent.setup();
    setup(); // GK slot

    // A striker is not offered for the goalkeeper slot, however you search.
    await user.type(screen.getByLabelText('Search by player or club'), 'haaland');
    expect(screen.getByTestId('search-empty')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Show all positions'));

    expect(within(results()).getByText('Erling Haaland')).toBeInTheDocument();
  });

  it('reports when nothing matches, and suggests widening the search', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText('Search by player or club'), 'zzzznotaplayer');

    const empty = screen.getByTestId('search-empty');
    expect(empty).toHaveTextContent(/No players match/);
    expect(empty).toHaveTextContent(/show all positions/);
    expect(screen.queryByRole('list', { name: 'Search results' })).not.toBeInTheDocument();
  });

  it('stops suggesting to widen once all positions are already shown', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByLabelText('Show all positions'));
    await user.type(screen.getByLabelText('Search by player or club'), 'zzzznotaplayer');

    expect(screen.getByTestId('search-empty')).not.toHaveTextContent(/show all positions/);
  });

  it('assigns the chosen player and closes', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup({ slot: stSlot });

    await user.type(screen.getByLabelText('Search by player or club'), 'haaland');
    await user.click(within(results()).getByText('Erling Haaland'));

    expect(onSelect).toHaveBeenCalledWith('mci-haaland');
  });

  it('marks players already in the lineup', () => {
    setup({ slot: stSlot, assignedPlayerIds: new Set(['mci-haaland']) });

    const haaland = within(results()).getByText('Erling Haaland').closest('button')!;
    expect(haaland).toHaveAttribute('data-in-use', 'true');
    expect(within(haaland).getByText('In lineup')).toBeInTheDocument();
  });

  it('still allows picking a player who is already in the lineup, to move them', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup({ slot: stSlot, assignedPlayerIds: new Set(['mci-haaland']) });

    await user.click(within(results()).getByText('Erling Haaland'));
    expect(onSelect).toHaveBeenCalledWith('mci-haaland');
  });

  it('closes without choosing anyone via Cancel', async () => {
    const user = userEvent.setup();
    const { onClose, onSelect } = setup();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows club colours on result shirts in club mode', () => {
    setup();
    const alisson = within(results()).getByText('Alisson').closest('button')!;
    expect(within(alisson).getByTestId('jersey')).toHaveAttribute('data-kit-shirt', '#c8102e');
  });

  it('shows the team theme on result shirts in custom mode', () => {
    const theme = KIT_PRESETS.find((p) => p.id === 'monochrome')!.kit;
    setup({ kitMode: 'custom', customKit: theme });

    const alisson = within(results()).getByText('Alisson').closest('button')!;
    expect(within(alisson).getByTestId('jersey')).toHaveAttribute('data-kit-shirt', theme.shirt);
  });

  it('resets the search box between openings', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup({ slot: stSlot });

    const input = screen.getByLabelText('Search by player or club');
    await user.type(input, 'haaland');
    await user.click(within(results()).getByText('Erling Haaland'));

    expect(onSelect).toHaveBeenCalled();
    // The component clears its own query so the next opening starts fresh.
    expect(input).toHaveValue('');
  });
});
