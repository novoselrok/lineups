import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getFormation } from '../../shared/formations';
import { KIT_PRESETS } from '../../shared/kits';
import { Pitch } from './Pitch';
import { clubsById, playersById, renderWithDnd } from '../test/render';

const customKit = KIT_PRESETS[0]!.kit;

function setup(overrides: Partial<Parameters<typeof Pitch>[0]> = {}): {
  onOpenSearch: ReturnType<typeof vi.fn>;
  onClear: ReturnType<typeof vi.fn>;
} {
  const onOpenSearch = vi.fn();
  const onClear = vi.fn();

  renderWithDnd(
    <Pitch
      formation={getFormation('4-3-3')}
      assignments={{}}
      playersById={playersById}
      clubsById={clubsById}
      kitMode="club"
      customKit={customKit}
      onOpenSearch={onOpenSearch}
      onClear={onClear}
      {...overrides}
    />,
  );

  return { onOpenSearch, onClear };
}

describe('Pitch', () => {
  it('renders one slot per position in the formation', () => {
    setup();
    for (const slot of getFormation('4-3-3').slots) {
      expect(screen.getByTestId(`slot-${slot.id}`)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId(/^slot-/)).toHaveLength(11);
  });

  it('renders the slot count of a different formation', () => {
    setup({ formation: getFormation('3-5-2') });
    expect(screen.getAllByTestId(/^slot-/)).toHaveLength(11);
    expect(screen.getByTestId('slot-lwb')).toBeInTheDocument();
  });

  it('labels empty slots with their position and marks them unfilled', () => {
    setup();
    const gk = screen.getByTestId('slot-gk');
    expect(gk).toHaveAttribute('data-filled', 'false');
    expect(screen.getByRole('button', { name: /Empty GK\. Add a player/ })).toBeInTheDocument();
  });

  it('shows the assigned player name and squad number', () => {
    setup({ assignments: { gk: 'liv-alisson', st1: 'mci-haaland' } });

    expect(screen.getByTestId('slot-gk')).toHaveAttribute('data-filled', 'true');
    expect(screen.getByText('Alisson')).toBeInTheDocument();
    expect(screen.getByText('Haaland')).toBeInTheDocument();
    // Squad numbers are printed on the shirts.
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it("shows each player's club badge text", () => {
    setup({ assignments: { gk: 'liv-alisson' } });
    expect(screen.getByText('LIV')).toBeInTheDocument();
  });

  it('opens the search modal for the clicked position', async () => {
    const user = userEvent.setup();
    const { onOpenSearch } = setup();

    await user.click(screen.getByRole('button', { name: /Empty GK/ }));
    expect(onOpenSearch).toHaveBeenCalledWith('gk');
  });

  it('opens the search modal when clicking a filled position too', async () => {
    const user = userEvent.setup();
    const { onOpenSearch } = setup({ assignments: { st1: 'mci-haaland' } });

    await user.click(screen.getByRole('button', { name: /Erling Haaland, ST\. Change player/ }));
    expect(onOpenSearch).toHaveBeenCalledWith('st1');
  });

  it('clears a position from its remove button', async () => {
    const user = userEvent.setup();
    const { onClear, onOpenSearch } = setup({ assignments: { st1: 'mci-haaland' } });

    await user.click(screen.getByRole('button', { name: /Remove Erling Haaland from ST/ }));
    expect(onClear).toHaveBeenCalledWith('st1');
    // Clearing must not also open the search modal.
    expect(onOpenSearch).not.toHaveBeenCalled();
  });

  it('offers a drag handle only for filled positions', () => {
    setup({ assignments: { st1: 'mci-haaland' } });
    expect(screen.getByTestId('drag-st1')).toBeInTheDocument();
    expect(screen.queryByTestId('drag-gk')).not.toBeInTheDocument();
  });

  it('paints club colours in club mode', () => {
    setup({ assignments: { gk: 'liv-alisson' }, kitMode: 'club' });
    // Liverpool red.
    expect(screen.getByTestId('slot-gk').querySelector('[data-kit-shirt]')).toHaveAttribute(
      'data-kit-shirt',
      '#c8102e',
    );
  });

  it('paints the team theme for every player in custom mode', () => {
    const theme = KIT_PRESETS.find((p) => p.id === 'monochrome')!.kit;
    setup({
      assignments: { gk: 'liv-alisson', st1: 'mci-haaland' },
      kitMode: 'custom',
      customKit: theme,
    });

    for (const slotId of ['gk', 'st1']) {
      expect(
        screen.getByTestId(`slot-${slotId}`).querySelector('[data-kit-shirt]'),
        `${slotId} should wear the theme`,
      ).toHaveAttribute('data-kit-shirt', theme.shirt);
    }
  });

  it('ignores an assignment referring to an unknown player', () => {
    setup({ assignments: { gk: 'no-such-player' } });
    expect(screen.getByTestId('slot-gk')).toHaveAttribute('data-filled', 'false');
  });
});
