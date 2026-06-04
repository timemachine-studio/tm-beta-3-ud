import React from 'react';
import { HelpCircle, Zap, Command, Type, Keyboard } from 'lucide-react';
import { ModuleData } from '../moduleRegistry';
import { AccentTheme, IconBadge } from './shared';

// ─── Help Sections ───────────────────────────────────────────

const SECTIONS = [
  {
    title: 'What is Contour?',
    description:
      'TimeMachine Contour is a smart assist overlay built into your chat. It gives you instant access to tools, converters, and utilities — all without leaving the conversation.',
  },
  {
    title: 'Slash Commands',
    icon: Command,
    description:
      'Type / in the textbox to open the command palette. Search for any tool by name, then press Enter to open it.',
    examples: ['/calculator', '/dictionary', '/settings'],
  },
  {
    title: 'Auto-Detect',
    icon: Zap,
    description:
      'Just type naturally. Contour automatically detects what you need and shows the right tool — no slash command required.',
    examples: ['5km to miles', '#ff5733', 'hello in spanish', 'define serendipity'],
  },
  {
    title: 'Keyboard Shortcuts',
    icon: Keyboard,
    description: 'Navigate Contour quickly with your keyboard.',
    shortcuts: [
      { keys: ['Ctrl', 'K'], action: 'Open command palette' },
      { keys: ['/'], action: 'Open command palette' },
      { keys: ['\u2191', '\u2193'], action: 'Navigate commands' },
      { keys: ['\u21B5'], action: 'Select command or copy result' },
      { keys: ['Esc'], action: 'Dismiss' },
    ],
  },
];

const TOOL_CATEGORIES = [
  {
    label: 'Converters',
    tools: ['Unit Converter', 'Currency', 'Timezone', 'Color'],
  },
  {
    label: 'Utilities',
    tools: ['Calculator', 'Timer', 'Date Calc', 'Random', 'Word Counter', 'Dictionary', 'Translator'],
  },
  {
    label: 'Developer',
    tools: ['JSON Formatter', 'Base64', 'URL Encoder', 'Hash Generator', 'Regex Tester', 'Lorem Ipsum'],
  },
  {
    label: 'System',
    tools: ['Settings', 'Chat History', 'Album', 'Memories'],
  },
];

// ─── Help View ──────────────────────────────────────────────

function HelpView({ module, accent }: { module: ModuleData; accent: AccentTheme }) {
  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <IconBadge icon={HelpCircle} accent={accent} />
        <div>
          <div className="text-white text-base font-semibold">TimeMachine Contour</div>
          <div className="text-white/30 text-xs">Your smart assist toolkit</div>
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map((section, i) => (
        <div key={i}>
          <div className="flex items-center gap-2 mb-1.5">
            {section.icon && <section.icon className={`w-3.5 h-3.5 ${accent.text}`} />}
            <span className="text-white/80 text-sm font-medium">{section.title}</span>
          </div>
          <p className="text-white/40 text-xs leading-relaxed">{section.description}</p>

          {section.examples && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {section.examples.map((ex, j) => (
                <span
                  key={j}
                  className="text-[11px] px-2 py-1 rounded-lg font-mono"
                  style={{ background: accent.bg, border: `1px solid ${accent.border}`, color: accent.solid }}
                >
                  {ex}
                </span>
              ))}
            </div>
          )}

          {section.shortcuts && (
            <div className="mt-2 space-y-1">
              {section.shortcuts.map((sc, j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {sc.keys.map((k, ki) => (
                      <kbd
                        key={ki}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-white/40"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                  <span className="text-white/30 text-[11px]">{sc.action}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Available Tools Grid */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Type className={`w-3.5 h-3.5 ${accent.text}`} />
          <span className="text-white/80 text-sm font-medium">Available Tools</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TOOL_CATEGORIES.map((cat, i) => (
            <div
              key={i}
              className="rounded-lg p-2"
              style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
            >
              <div
                className="text-[10px] font-medium tracking-wider uppercase mb-1"
                style={{ color: accent.solid }}
              >
                {cat.label}
              </div>
              <div className="text-white/30 text-[11px] leading-relaxed">
                {cat.tools.join(' \u00B7 ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <span className="text-[10px] text-white/20">Press Esc to close</span>
      </div>
    </div>
  );
}

export { HelpView };
