import React from 'react';
import { Type } from 'lucide-react';
import { ModuleData, MODULE_META } from '../moduleRegistry';
import { getStatItems } from '../modules/wordCounter';
import { AccentTheme, IconBadge, HintView, FooterHint, ICON_MAP } from './shared';

// ─── Word Counter View ─────────────────────────────────────────

export function WordCountView({ module, accent }: { module: ModuleData; accent: AccentTheme }) {
  const wc = module.wordcount;

  if (!wc && module.focused) {
    return <HintView icon={Type} accent={accent} text={MODULE_META.wordcount.placeholder} />;
  }
  if (!wc) return null;

  const stats = getStatItems(wc);

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <IconBadge icon={Type} accent={accent} />
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium">
            {wc.words.toLocaleString()} {wc.words === 1 ? 'word' : 'words'}
          </div>
          <div className="text-white/30 text-xs">
            {wc.characters.toLocaleString()} characters
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {stats.map(stat => {
          const StatIcon = ICON_MAP[stat.icon] || Type;
          return (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1 p-2 rounded-lg"
              style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
            >
              <StatIcon className={`w-3.5 h-3.5 ${accent.text}`} />
              <span className="text-white text-xs font-semibold">{stat.value}</span>
              <span className="text-white/25 text-[9px]">{stat.label}</span>
            </div>
          );
        })}
      </div>

      <FooterHint text={module.focused ? 'Type or paste text above' : 'Use /word-count to analyze text'} />
    </div>
  );
}
