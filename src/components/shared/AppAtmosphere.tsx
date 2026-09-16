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
  return (
    <div className="tm-atmosphere" aria-hidden="true" style={{ '--tm-atmo-rgb': colors[0] } as React.CSSProperties}>
      {/* Low and wide, as under the landing composer: the light sits behind
          the dock and reaches into both lower corners. */}
      <div className="tm-orb tm-orb-a left-[-12%] bottom-[-24%] h-[60vmax] w-[60vmax]" style={{ background: 'rgb(' + colors[0] + ' / 0.28)' }} />
      <div className="tm-orb tm-orb-b right-[-10%] bottom-[-16%] h-[46vmax] w-[46vmax]" style={{ background: 'rgb(' + colors[1] + ' / 0.16)' }} />
      <div className="tm-orb tm-orb-c left-[34%] top-[-18%] h-[40vmax] w-[40vmax]" style={{ background: 'rgb(' + colors[2] + ' / 0.1)' }} />
    </div>
  );
}
