import { contrastingTextColor } from '../../shared/kits';
import type { Kit } from '../../shared/types';

interface JerseyProps {
  kit: Kit;
  /** Squad number printed on the shirt. Omitted for an empty slot. */
  number?: number;
  size?: number;
  /** Exposed for tests and for the drag preview. */
  title?: string;
}

/**
 * An SVG shirt coloured entirely from a `Kit`. The pattern overlay is clipped to the
 * shirt body, so stripes and sashes never bleed over the sleeves or outside the outline.
 */
export function Jersey({ kit, number, size = 44, title }: JerseyProps) {
  // Unique per render so multiple jerseys on the pitch never share clip/pattern ids.
  const uid = `${kit.shirt}-${kit.pattern}-${number ?? 'empty'}`.replace(/[^a-z0-9-]/gi, '');
  const bodyClip = `body-${uid}`;
  const numberColor = kit.number;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title ?? 'Shirt'}
      data-testid="jersey"
      data-kit-shirt={kit.shirt}
      data-kit-pattern={kit.pattern}
    >
      {title ? <title>{title}</title> : null}

      <defs>
        <clipPath id={bodyClip}>
          <path d="M20 10 L32 15 L44 10 L52 16 L48 26 L46 24 L46 56 L18 56 L18 24 L16 26 L12 16 Z" />
        </clipPath>
      </defs>

      {/* Sleeves and collar sit under the body so the shoulders read cleanly. */}
      <path
        d="M20 10 L12 16 L16 28 L22 24 Z M44 10 L52 16 L48 28 L42 24 Z"
        fill={kit.sleeve}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.75"
      />

      {/* Shirt body. */}
      <path
        d="M20 10 L32 15 L44 10 L52 16 L48 26 L46 24 L46 56 L18 56 L18 24 L16 26 L12 16 Z"
        fill={kit.shirt}
      />

      <g clipPath={`url(#${bodyClip})`}>
        {kit.pattern === 'stripes' &&
          [22, 30, 38].map((x) => (
            <rect key={x} x={x} y="8" width="4.5" height="50" fill={kit.sleeve} opacity="0.95" />
          ))}
        {kit.pattern === 'halves' && <rect x="32" y="8" width="24" height="50" fill={kit.sleeve} />}
        {kit.pattern === 'sash' && (
          <path d="M12 20 L52 48 L52 40 L12 12 Z" fill={kit.sleeve} opacity="0.95" />
        )}
      </g>

      {/* Outline last so it sits on top of the pattern. */}
      <path
        d="M20 10 L32 15 L44 10 L52 16 L48 26 L46 24 L46 56 L18 56 L18 24 L16 26 L12 16 Z"
        fill="none"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="1"
      />

      {/* Collar. */}
      <path
        d="M26 11 L32 16 L38 11"
        fill="none"
        stroke={contrastingTextColor(kit.shirt)}
        strokeWidth="1.5"
        opacity="0.5"
      />

      {number !== undefined && (
        <text
          x="32"
          y="44"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill={numberColor}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="0.4"
          data-testid="jersey-number"
        >
          {number}
        </text>
      )}
    </svg>
  );
}
