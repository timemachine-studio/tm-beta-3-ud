import React from 'react';
import { useTheme } from '../../context/ThemeContext';

const seasons: Record<string, [string, string, string]> = {
  autumnDark: ['168 85 247', '236 72 153', '34 211 238'],
  springDark: ['239 68 68', '236 72 153', '249 115 22'],
  summerDark: ['34 211 238', '59 130 246', '168 85 247'],
  winterDark: ['59 130 246', '168 85 247', '34 211 238'],
  blossomDark: ['236 72 153', '251 113 133', '168 85 247'],
  verdureDark: ['34 197 94', '20 184 166', '132 204 22'],
  emberDark: ['249 115 22', '239 68 68', '234 179 8'],
  sunflareDark: ['234 179 8', '249 115 22', '251 191 36'],
};

/** Shared lighting for app pages; each tool can choose its own accent. */
export function AppAtmosphere({ variant, hue }: { variant?: 'healthcare'; hue?: string }) {
  const { mode, accentSeason } = useTheme();
  if (mode === 'light' || (!variant && !hue && accentSeason === 'pureDark')) return null;
  const colors = variant === 'healthcare'
    ? ['16 185 129', '20 184 166', '56 189 248']
    : hue ? [hue.replace(/,/g, ' '), '168 85 247', '34 211 238'] : seasons[accentSeason] || seasons.autumnDark;
  // Gradients only (material.css): the pools are painted from these three
  // hues, so a persona or season switch is a colour transition.
  return (
    <div
      className="tm-atmosphere"
      aria-hidden="true"
      style={{ '--tm-atmo-rgb': colors[0], '--tm-atmo-2': colors[1], '--tm-atmo-3': colors[2] } as React.CSSProperties}
    />
  );
}
