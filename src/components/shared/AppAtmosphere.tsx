import React from 'react';
import { useTheme } from '../../context/ThemeContext';

const seasons: Record<string, [string, string, string]> = {
  autumnDark: ['168 85 247', '236 72 153', '34 211 238'],
  springDark: ['236 72 153', '168 85 247', '251 113 133'],
  summerDark: ['34 211 238', '59 130 246', '168 85 247'],
  winterDark: ['59 130 246', '168 85 247', '34 211 238'],
};

/** Shared lighting for app pages; each tool can choose its own accent. */
export function AppAtmosphere({ variant, hue }: { variant?: 'healthcare'; hue?: string }) {
  const { mode, season } = useTheme();
  if (mode === 'light' || (!variant && !hue && season === 'pureDark')) return null;
  const colors = variant === 'healthcare'
    ? ['16 185 129', '20 184 166', '56 189 248']
    : hue ? [hue.replace(/,/g, ' '), '168 85 247', '34 211 238'] : seasons[season] || seasons.autumnDark;
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
