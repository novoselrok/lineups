import { KIT_PATTERNS, KIT_PRESETS } from '../../shared/kits';
import type { Kit, KitMode } from '../../shared/types';
import { Jersey } from './Jersey';

interface KitPanelProps {
  kitMode: KitMode;
  customKit: Kit;
  onKitModeChange: (mode: KitMode) => void;
  onApplyPreset: (presetId: string) => void;
  onColorChange: (key: keyof Omit<Kit, 'pattern'>, value: string) => void;
  onPatternChange: (pattern: Kit['pattern']) => void;
}

const COLOR_FIELDS: { key: keyof Omit<Kit, 'pattern'>; label: string }[] = [
  { key: 'shirt', label: 'Shirt' },
  { key: 'sleeve', label: 'Sleeves / trim' },
  { key: 'shorts', label: 'Shorts' },
  { key: 'number', label: 'Number' },
];

/**
 * Controls whether players wear their own club colours or one team-wide theme.
 * Presets are starting points; every colour stays editable afterwards.
 */
export function KitPanel({
  kitMode,
  customKit,
  onKitModeChange,
  onApplyPreset,
  onColorChange,
  onPatternChange,
}: KitPanelProps) {
  return (
    <section className="panel" aria-label="Team kit">
      <h2 className="panel-title">Kit</h2>

      <div className="kit-mode" role="radiogroup" aria-label="Kit mode">
        <button
          type="button"
          role="radio"
          aria-checked={kitMode === 'club'}
          className="kit-mode-option"
          data-active={kitMode === 'club' ? 'true' : 'false'}
          onClick={() => onKitModeChange('club')}
        >
          Club kits
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={kitMode === 'custom'}
          className="kit-mode-option"
          data-active={kitMode === 'custom' ? 'true' : 'false'}
          onClick={() => onKitModeChange('custom')}
        >
          Custom theme
        </button>
      </div>

      <p className="panel-hint">
        {kitMode === 'club'
          ? 'Every player wears their own club colours.'
          : 'All eleven players wear the theme below.'}
      </p>

      <div className="kit-preview" data-testid="kit-preview">
        <Jersey kit={customKit} number={10} size={64} title="Current theme" />
      </div>

      <h3 className="panel-subtitle">Presets</h3>
      <ul className="kit-presets">
        {KIT_PRESETS.map((preset) => (
          <li key={preset.id}>
            <button
              type="button"
              className="kit-preset"
              aria-label={`Apply ${preset.name} kit`}
              onClick={() => onApplyPreset(preset.id)}
            >
              <Jersey kit={preset.kit} size={34} title={`${preset.name} shirt`} />
              <span>{preset.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <h3 className="panel-subtitle">Colours</h3>
      <div className="kit-colors">
        {COLOR_FIELDS.map(({ key, label }) => (
          <label key={key} className="kit-color">
            <span>{label}</span>
            <input
              type="color"
              aria-label={label}
              value={customKit[key]}
              onChange={(event) => onColorChange(key, event.target.value)}
            />
          </label>
        ))}
      </div>

      <label className="kit-pattern">
        <span>Pattern</span>
        <select
          aria-label="Pattern"
          value={customKit.pattern}
          onChange={(event) => onPatternChange(event.target.value as Kit['pattern'])}
        >
          {KIT_PATTERNS.map((pattern) => (
            <option key={pattern} value={pattern}>
              {pattern[0]!.toUpperCase() + pattern.slice(1)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
