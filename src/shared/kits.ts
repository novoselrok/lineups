import type { Club, Kit, KitPattern, Lineup, Player } from './types';

export const KIT_PATTERNS = [
  'solid',
  'stripes',
  'halves',
  'sash',
] as const satisfies readonly KitPattern[];

export interface KitPreset {
  id: string;
  name: string;
  kit: Kit;
}

/** Starting points for a team-wide theme; each is still editable colour by colour. */
export const KIT_PRESETS: KitPreset[] = [
  {
    id: 'classic-red',
    name: 'Classic Red',
    kit: {
      shirt: '#c8102e',
      sleeve: '#a00d24',
      shorts: '#ffffff',
      number: '#ffffff',
      pattern: 'solid',
    },
  },
  {
    id: 'royal-blue',
    name: 'Royal Blue',
    kit: {
      shirt: '#1d4ed8',
      sleeve: '#1739a8',
      shorts: '#ffffff',
      number: '#ffffff',
      pattern: 'solid',
    },
  },
  {
    id: 'away-white',
    name: 'Away White',
    kit: {
      shirt: '#f8fafc',
      sleeve: '#e2e8f0',
      shorts: '#0f172a',
      number: '#0f172a',
      pattern: 'solid',
    },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    kit: {
      shirt: '#18181b',
      sleeve: '#27272a',
      shorts: '#18181b',
      number: '#fafafa',
      pattern: 'solid',
    },
  },
  {
    id: 'black-white-stripes',
    name: 'Black & White Stripes',
    kit: {
      shirt: '#f5f5f5',
      sleeve: '#111111',
      shorts: '#111111',
      number: '#111111',
      pattern: 'stripes',
    },
  },
  {
    id: 'sunrise-sash',
    name: 'Sunrise Sash',
    kit: {
      shirt: '#fb923c',
      sleeve: '#ea580c',
      shorts: '#7c2d12',
      number: '#ffffff',
      pattern: 'sash',
    },
  },
  {
    id: 'forest-halves',
    name: 'Forest Halves',
    kit: {
      shirt: '#15803d',
      sleeve: '#052e16',
      shorts: '#052e16',
      number: '#ffffff',
      pattern: 'halves',
    },
  },
];

export const DEFAULT_CUSTOM_KIT: Kit = KIT_PRESETS[0]!.kit;

/** Shown when a player's club is missing from the catalog — never blocks rendering. */
export const FALLBACK_KIT: Kit = {
  shirt: '#9ca3af',
  sleeve: '#6b7280',
  shorts: '#374151',
  number: '#ffffff',
  pattern: 'solid',
};

export function findKitPreset(id: string): KitPreset | undefined {
  return KIT_PRESETS.find((preset) => preset.id === id);
}

/**
 * The single source of truth for what colours a shirt renders in.
 *
 * In 'club' mode each player keeps their own club's kit; in 'custom' mode the whole
 * team wears the lineup's theme. A custom mode with no theme set yet falls back to
 * the club kit rather than rendering an invisible shirt.
 */
export function resolveKit(
  player: Player,
  lineup: Pick<Lineup, 'kitMode' | 'customKit'>,
  clubsById: ReadonlyMap<string, Club>,
): Kit {
  if (lineup.kitMode === 'custom' && lineup.customKit) {
    return lineup.customKit;
  }
  return clubsById.get(player.clubId)?.kit ?? FALLBACK_KIT;
}

/** Convenience for callers holding an array rather than a map. */
export function clubsToMap(clubs: readonly Club[]): Map<string, Club> {
  return new Map(clubs.map((club) => [club.id, club]));
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/**
 * Picks black or white for text drawn on top of `background`, using the WCAG
 * relative-luminance formula so numbers stay readable on any custom colour.
 */
export function contrastingTextColor(background: string): '#000000' | '#ffffff' {
  if (!isHexColor(background)) return '#ffffff';
  const channel = (offset: number) => {
    const srgb = parseInt(background.slice(offset, offset + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.179 ? '#000000' : '#ffffff';
}
