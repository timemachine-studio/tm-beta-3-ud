import { popupExit, scrimExit } from '../../utils/popupMotion';
import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Moon, Sparkles, Info, Mail, Check, PanelLeft, Type } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { seasonThemes } from '../../themes/seasons';
import type { SeasonTheme } from '../../context/themeContextValue';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The glass recipe the main chat uses for its pills, written once with the
 * theme-aware primitives so the modal is the same material in both modes.
 */
const pane = {
  background: 'rgb(var(--tm-ink-rgb) / 0.04)',
  backdropFilter: 'blur(var(--tm-blur-glass))',
  WebkitBackdropFilter: 'blur(var(--tm-blur-glass))',
  border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
  boxShadow: 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)',
} as const;

const paneSelected = {
  ...pane,
  background: 'color-mix(in srgb, var(--color-purple-500) 10%, transparent)',
  border: '1px solid color-mix(in srgb, var(--color-purple-500) 50%, transparent)',
} as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium text-ink-muted mb-3">
      {children}
    </p>
  );
}

export const SettingsModal = React.memo(({ isOpen, onClose }: SettingsModalProps) => {
  const navigate = useNavigate();
  const { mode, season, seasonFollowsPersona, lightWarmth, uiStyle, setMode, setSeason, setLightWarmth, setUiStyle } = useTheme();

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const seasonEntries = Object.entries(seasonThemes) as [SeasonTheme, (typeof seasonThemes)[SeasonTheme]][];

  // Root stays mounted and the Portal is what AnimatePresence gates, so the
  // exit animation gets to play before Radix tears the dialog down.
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={scrimExit}
                className="tm-modal-scrim fixed inset-0 z-50"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={popupExit}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="tm-dialog-viewport fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
              >
                <div
                  className="tm-workspace tm-settings tm-glass tm-surface tm-dialog-card relative w-full max-w-lg rounded-[28px]"
                >
                  <div className="relative p-6 space-y-7">
                    <div className="flex items-center justify-between">
                      <Dialog.Title className="tm-display tm-dialog-heading text-white">Settings</Dialog.Title>
                      <Dialog.Close asChild>
                        <motion.button
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          className="p-2 rounded-full"
                          style={pane}
                          aria-label="Close settings"
                        >
                          <X className="w-4.5 h-4.5 text-ink" />
                        </motion.button>
                      </Dialog.Close>
                    </div>

                    <section>
                      <SectionLabel>Appearance</SectionLabel>
                      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Theme">
                        {([
                          { value: 'light', label: 'Light', hint: 'Flat and calm', Icon: Sun },
                          { value: 'dark', label: 'Dark', hint: 'Black, with seasons', Icon: Moon },
                        ] as const).map(({ value, label, hint, Icon }) => {
                          const selected = mode === value;
                          return (
                            <motion.button
                              key={value}
                              role="radio"
                              aria-checked={selected}
                              whileHover={{ scale: 1.015 }}
                              whileTap={{ scale: 0.985 }}
                              onClick={() => setMode(value)}
                              className="relative flex flex-col items-start gap-3 p-4 rounded-2xl text-left transition-colors"
                              style={selected ? paneSelected : pane}
                            >
                              <span
                                aria-hidden
                                className="block w-full h-14 rounded-xl overflow-hidden"
                                style={
                                  value === 'light'
                                    ? { background: '#fdf1e1', border: '1px solid #eadcc6' }
                                    : { background: '#000', border: '1px solid rgb(255 255 255 / 0.12)' }
                                }
                              >
                                {/* A miniature of each mode: a card on the canvas with one line of ink. */}
                                <span
                                  className="block h-8 mx-3 mt-4 rounded-lg"
                                  style={
                                    value === 'light'
                                      ? { background: '#fffaf3', border: '1px solid #eadcc6' }
                                      // Opaque hex on purpose: light mode's category rules neutralise
                                      // any inline rgba() fill, and this is a picture of dark mode.
                                      : { background: '#111111', border: '1px solid #2a2a2a' }
                                  }
                                >
                                  <span
                                    className="block h-2 w-14 mt-3 ml-3 rounded-full"
                                    style={{ background: value === 'light' ? '#1a1a1a' : '#e6e6e6' }}
                                  />
                                </span>
                              </span>
                              <span className="flex items-center gap-2 w-full">
                                <Icon className="w-4 h-4 text-ink" />
                                <span className="text-sm font-medium text-white">{label}</span>
                                {selected && <Check className="w-4 h-4 ml-auto text-purple-400" />}
                              </span>
                              <span className="text-xs text-ink-muted -mt-2">{hint}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </section>

                    <AnimatePresence initial={false}>
                      {mode === 'light' && (
                        <motion.section
                          key="warmth"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <SectionLabel>Paper</SectionLabel>
                          <div className="flex items-center gap-3 p-3.5 rounded-2xl" style={pane}>
                            <span
                              aria-hidden
                              className="w-5 h-5 rounded-full shrink-0"
                              style={{ background: '#ffffff', border: '1px solid #d9d9d5' }}
                            />
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={lightWarmth}
                              onChange={(e) => setLightWarmth(Number(e.target.value))}
                              aria-label="Paper warmth, white to beige"
                              className="tm-range flex-1"
                            />
                            <span
                              aria-hidden
                              className="w-5 h-5 rounded-full shrink-0"
                              style={{ background: '#fdf1e1', border: '1px solid #e2d3b8' }}
                            />
                          </div>
                          <p className="text-xs text-ink-muted mt-3">White on the left, beige on the right.</p>
                        </motion.section>
                      )}
                      {mode === 'dark' && (
                        <motion.section
                          key="seasons"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <SectionLabel>Season</SectionLabel>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" role="radiogroup" aria-label="Season">
                            <SeasonSwatch
                              label="Auto"
                              hint="Follows persona"
                              selected={seasonFollowsPersona}
                              onSelect={() => setSeason('auto')}
                              swatch={
                                <span className="flex items-center justify-center w-full h-full">
                                  <Sparkles className="w-5 h-5 text-ink" />
                                </span>
                              }
                              swatchClassName="bg-white/5"
                            />
                            {seasonEntries.map(([key, s]) => (
                              <SeasonSwatch
                                key={key}
                                label={s.name.split(' ')[0]}
                                hint={s.name}
                                selected={!seasonFollowsPersona && season === key}
                                onSelect={() => setSeason(key)}
                                swatchClassName={s.background}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-ink-muted mt-3">
                            Each persona brings its own colour — Air, Girlie and PRO. Pick a season to
                            recolour the room now; switching persona brings its colour back. Pure is black with no colour at all.
                          </p>
                        </motion.section>
                      )}
                    </AnimatePresence>

                    <section>
                      <SectionLabel>Interface</SectionLabel>
                      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Interface">
                        {([
                          { value: 'current', label: 'Current', hint: 'Sidebar and glass', Icon: PanelLeft },
                          { value: 'legacy', label: 'Legacy', hint: 'The classic layout', Icon: Type },
                        ] as const).map(({ value, label, hint, Icon }) => {
                          const selected = uiStyle === value;
                          return (
                            <motion.button
                              key={value}
                              role="radio"
                              aria-checked={selected}
                              whileHover={{ scale: 1.015 }}
                              whileTap={{ scale: 0.985 }}
                              onClick={() => setUiStyle(value)}
                              className="relative flex flex-col items-start gap-3 p-4 rounded-2xl text-left transition-colors"
                              style={selected ? paneSelected : pane}
                            >
                              {/* A miniature of each shell: the current one has a rail
                                  and a pill for the brand; the legacy one is the brand
                                  alone in the corner over an open room. */}
                              <span
                                aria-hidden
                                className="relative block w-full h-14 rounded-xl overflow-hidden"
                                style={{ background: '#0a0710', border: '1px solid rgb(255 255 255 / 0.12)' }}
                              >
                                {value === 'current' ? (
                                  <>
                                    <span className="absolute inset-y-0 left-0 w-[30%]" style={{ background: 'rgb(255 255 255 / 0.06)', borderRight: '1px solid rgb(255 255 255 / 0.08)' }} />
                                    <span className="absolute top-2 left-[36%] h-2.5 w-10 rounded-full" style={{ background: 'rgb(168 85 247 / 0.35)', border: '1px solid rgb(168 85 247 / 0.5)' }} />
                                    <span className="absolute bottom-2 left-[36%] right-2 h-2.5 rounded-full" style={{ background: 'rgb(255 255 255 / 0.1)' }} />
                                  </>
                                ) : (
                                  <>
                                    <span className="absolute top-2 left-2 h-2 w-10 rounded-full" style={{ background: '#c084fc', boxShadow: '0 0 8px rgb(168 85 247 / 0.7)' }} />
                                    <span className="absolute bottom-2 left-2 h-2.5 w-2.5 rounded-full" style={{ background: 'rgb(168 85 247 / 0.4)' }} />
                                    <span className="absolute bottom-2 left-6 right-2 h-2.5 rounded-full" style={{ background: 'rgb(255 255 255 / 0.1)', border: '1px solid rgb(255 255 255 / 0.1)' }} />
                                  </>
                                )}
                              </span>
                              <span className="flex items-center gap-2 w-full">
                                <Icon className="w-4 h-4 text-ink" />
                                <span className="text-sm font-medium text-white">{label}</span>
                                {selected && <Check className="w-4 h-4 ml-auto text-purple-400" />}
                              </span>
                              <span className="text-xs text-ink-muted -mt-2">{hint}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-ink-muted mt-3">
                        Current keeps your chats in a sidebar. Legacy is the layout before it.
                      </p>
                    </section>

                    <section>
                      <SectionLabel>More</SectionLabel>
                      <div className="space-y-2">
                        <RowLink Icon={Info} title="About" hint="What TimeMachine is" onClick={() => go('/about')} />
                        <RowLink Icon={Mail} title="Contact" hint="Get in touch with the team" onClick={() => go('/contact')} />
                      </div>
                    </section>

                    <p className="text-center text-ink-muted text-xs tracking-wide">TimeMachine v1.0</p>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
});

SettingsModal.displayName = 'SettingsModal';

function SeasonSwatch({
  label,
  hint,
  selected,
  onSelect,
  swatch,
  swatchClassName,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
  swatch?: React.ReactNode;
  swatchClassName: string;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      aria-label={hint}
      onClick={onSelect}
      className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
    >
      <span
        className={`relative block w-12 h-12 rounded-full overflow-hidden transition-transform duration-200 ${swatchClassName} ${
          selected ? 'scale-105' : 'group-hover:scale-105'
        }`}
        style={{
          border: selected
            ? '2px solid color-mix(in srgb, var(--color-purple-500) 70%, transparent)'
            : '1px solid rgb(var(--tm-ink-rgb) / 0.12)',
          boxShadow: selected
            ? '0 0 0 3px color-mix(in srgb, var(--color-purple-500) 22%, transparent), inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)'
            : 'inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.12)',
        }}
      >
        {swatch}
      </span>
      <span className={`text-xs font-medium ${selected ? 'text-white' : 'text-ink-muted'}`}>{label}</span>
    </button>
  );
}

function RowLink({
  Icon,
  title,
  hint,
  onClick,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left"
      style={pane}
    >
      <Icon className="w-4.5 h-4.5 text-purple-400" />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-white">{title}</span>
        <span className="text-xs text-ink-muted">{hint}</span>
      </span>
    </motion.button>
  );
}
