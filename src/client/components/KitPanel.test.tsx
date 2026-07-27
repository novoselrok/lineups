import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KIT_PRESETS } from '../../shared/kits';
import { KitPanel } from './KitPanel';
import { renderWithDnd } from '../test/render';

const baseKit = KIT_PRESETS[0]!.kit;

function setup(overrides: Partial<Parameters<typeof KitPanel>[0]> = {}) {
  const handlers = {
    onKitModeChange: vi.fn(),
    onApplyPreset: vi.fn(),
    onColorChange: vi.fn(),
    onPatternChange: vi.fn(),
  };

  renderWithDnd(<KitPanel kitMode="club" customKit={baseKit} {...handlers} {...overrides} />);

  return handlers;
}

describe('KitPanel', () => {
  it('shows which kit mode is active', () => {
    setup({ kitMode: 'club' });

    expect(screen.getByRole('radio', { name: 'Club kits' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Custom theme' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('explains what each mode does', () => {
    setup({ kitMode: 'club' });
    expect(screen.getByText(/own club colours/)).toBeInTheDocument();
  });

  it('explains the custom mode when it is active', () => {
    setup({ kitMode: 'custom' });
    expect(screen.getByText(/All eleven players wear the theme/)).toBeInTheDocument();
  });

  it('switches to a custom theme', async () => {
    const user = userEvent.setup();
    const { onKitModeChange } = setup({ kitMode: 'club' });

    await user.click(screen.getByRole('radio', { name: 'Custom theme' }));
    expect(onKitModeChange).toHaveBeenCalledWith('custom');
  });

  it('switches back to club kits', async () => {
    const user = userEvent.setup();
    const { onKitModeChange } = setup({ kitMode: 'custom' });

    await user.click(screen.getByRole('radio', { name: 'Club kits' }));
    expect(onKitModeChange).toHaveBeenCalledWith('club');
  });

  it('offers every preset', () => {
    setup();
    for (const preset of KIT_PRESETS) {
      expect(screen.getByRole('button', { name: `Apply ${preset.name} kit` })).toBeInTheDocument();
    }
  });

  it('applies a chosen preset', async () => {
    const user = userEvent.setup();
    const { onApplyPreset } = setup();

    const preset = KIT_PRESETS.find((p) => p.id === 'monochrome')!;
    await user.click(screen.getByRole('button', { name: `Apply ${preset.name} kit` }));

    expect(onApplyPreset).toHaveBeenCalledWith('monochrome');
  });

  it('previews the current theme colours on a shirt', () => {
    const theme = KIT_PRESETS.find((p) => p.id === 'forest-halves')!.kit;
    setup({ customKit: theme });

    // The first jersey is the large preview at the top of the panel.
    const preview = screen.getByLabelText('Current theme');
    expect(preview).toHaveAttribute('data-kit-shirt', theme.shirt);
    expect(preview).toHaveAttribute('data-kit-pattern', 'halves');
  });

  it('exposes a colour input per kit part, showing the current value', () => {
    setup({ customKit: baseKit });

    expect(screen.getByLabelText('Shirt')).toHaveValue(baseKit.shirt);
    expect(screen.getByLabelText('Sleeves / trim')).toHaveValue(baseKit.sleeve);
    expect(screen.getByLabelText('Shorts')).toHaveValue(baseKit.shorts);
    expect(screen.getByLabelText('Number')).toHaveValue(baseKit.number);
  });

  it('reports a changed shirt colour', () => {
    const { onColorChange } = setup();

    // A colour input cannot be typed into, so fire the change directly.
    fireEvent.change(screen.getByLabelText('Shirt'), { target: { value: '#123456' } });

    expect(onColorChange).toHaveBeenCalledWith('shirt', '#123456');
  });

  it('reports a changed shorts colour independently of the shirt', () => {
    const { onColorChange } = setup();

    fireEvent.change(screen.getByLabelText('Shorts'), { target: { value: '#abcdef' } });

    expect(onColorChange).toHaveBeenCalledWith('shorts', '#abcdef');
  });

  it('reports a changed pattern', async () => {
    const user = userEvent.setup();
    const { onPatternChange } = setup();

    await user.selectOptions(screen.getByLabelText('Pattern'), 'stripes');
    expect(onPatternChange).toHaveBeenCalledWith('stripes');
  });

  it('shows the current pattern as selected', () => {
    setup({ customKit: { ...baseKit, pattern: 'sash' } });
    expect(screen.getByLabelText('Pattern')).toHaveValue('sash');
  });
});
