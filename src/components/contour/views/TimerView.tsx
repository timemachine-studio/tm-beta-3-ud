import React, { useState } from 'react';
import { Timer, Play, Pause, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { ModuleData } from '../moduleRegistry';
import { TimerState } from '../modules/timer';
import { AccentTheme, IconBadge, FooterHint } from './shared';

const TIMER_PRESETS = [
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
];

function TimerView({ module, accent, onStart, onToggle, onReset, onSetDuration }: {
  module: ModuleData; accent: AccentTheme;
  onStart?: () => void; onToggle?: () => void; onReset?: () => void;
  onSetDuration?: (seconds: number) => void;
}) {
  const timer = module.timer;

  if (!module.focused) {
    // Non-focused: unchanged simple display
    if (!timer) return null;
    return <TimerDisplay timer={timer} accent={accent} onStart={onStart} onToggle={onToggle} onReset={onReset} />;
  }

  // Focused mode: interactive UI
  return (
    <TimerInteractive
      timer={timer}
      accent={accent}
      onStart={onStart}
      onToggle={onToggle}
      onReset={onReset}
      onSetDuration={onSetDuration}
    />
  );
}

function TimerDisplay({ timer, accent, onStart, onToggle, onReset }: {
  timer: TimerState; accent: AccentTheme;
  onStart?: () => void; onToggle?: () => void; onReset?: () => void;
}) {
  const progressPercent = timer.progress * 100;

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <IconBadge icon={Timer} accent={accent} />
        <div className="flex-1 min-w-0">
          <div className="text-white/30 text-xs mb-1">{timer.label} timer</div>
          <div className={`text-3xl font-mono font-bold tracking-tight ${timer.isComplete ? accent.text : 'text-white'}`}>
            {timer.display}
          </div>
        </div>
      </div>

      <div className="h-1 rounded-full bg-white/10 mb-3 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: accent.solid }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex items-center gap-2">
        {!timer.isRunning && !timer.isComplete && timer.remainingSeconds === timer.totalSeconds && (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 transition-colors"
            style={{ background: accent.bg, border: `1px solid ${accent.border}` }}
          >
            <Play className="w-3 h-3" /> Start
          </button>
        )}
        {(timer.isRunning || (timer.remainingSeconds < timer.totalSeconds && !timer.isComplete)) && (
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 transition-colors"
            style={{ background: accent.bg, border: `1px solid ${accent.border}` }}
          >
            {timer.isRunning ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Resume</>}
          </button>
        )}
        {(timer.remainingSeconds < timer.totalSeconds || timer.isComplete) && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white/80 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
        {timer.isComplete && (
          <span className={`ml-auto text-sm font-medium ${accent.text}`}>Complete!</span>
        )}
      </div>

      {!timer.isRunning && !timer.isComplete && timer.remainingSeconds === timer.totalSeconds && (
        <div className="mt-2">
          <span className="text-[10px] text-white/20">Press Start or Enter to begin</span>
        </div>
      )}
    </div>
  );
}

function TimerInteractive({ timer, accent, onStart, onToggle, onReset, onSetDuration }: {
  timer?: TimerState; accent: AccentTheme;
  onStart?: () => void; onToggle?: () => void; onReset?: () => void;
  onSetDuration?: (seconds: number) => void;
}) {
  const [customH, setCustomH] = useState('0');
  const [customM, setCustomM] = useState('5');
  const [customS, setCustomS] = useState('0');

  const handlePreset = (seconds: number) => {
    onSetDuration?.(seconds);
  };

  const handleCustomSet = () => {
    const h = parseInt(customH) || 0;
    const m = parseInt(customM) || 0;
    const s = parseInt(customS) || 0;
    const total = h * 3600 + m * 60 + s;
    if (total > 0) onSetDuration?.(total);
  };

  // If a timer is set, show the timer display with controls
  if (timer) {
    const progressPercent = timer.progress * 100;
    return (
      <div className="p-4 space-y-3">
        {/* Timer display */}
        <div className="flex items-center gap-3">
          <IconBadge icon={Timer} accent={accent} />
          <div className="flex-1 min-w-0">
            <div className="text-white/30 text-xs mb-1">{timer.label} timer</div>
            <div className={`text-3xl font-mono font-bold tracking-tight ${timer.isComplete ? accent.text : 'text-white'}`}>
              {timer.display}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: accent.solid }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {!timer.isRunning && !timer.isComplete && timer.remainingSeconds === timer.totalSeconds && (
            <button
              onClick={onStart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 transition-colors"
              style={{ background: accent.bg, border: `1px solid ${accent.border}` }}
            >
              <Play className="w-3 h-3" /> Start
            </button>
          )}
          {(timer.isRunning || (timer.remainingSeconds < timer.totalSeconds && !timer.isComplete)) && (
            <button
              onClick={onToggle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 transition-colors"
              style={{ background: accent.bg, border: `1px solid ${accent.border}` }}
            >
              {timer.isRunning ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Resume</>}
            </button>
          )}
          {(timer.remainingSeconds < timer.totalSeconds || timer.isComplete) && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white/80 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          {timer.isComplete && (
            <span className={`ml-auto text-sm font-medium ${accent.text}`}>Complete!</span>
          )}
        </div>

        {/* Preset pills to quickly change duration (only when not running) */}
        {!timer.isRunning && !timer.isComplete && timer.remainingSeconds === timer.totalSeconds && (
          <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden pt-1">
            {TIMER_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => handlePreset(p.seconds)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                  timer.totalSeconds === p.seconds ? 'text-white' : 'text-white/40 hover:text-white/60'
                }`}
                style={timer.totalSeconds === p.seconds ? {
                  background: accent.bg,
                  border: `1px solid ${accent.border}`,
                } : {
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {!timer.isRunning && !timer.isComplete && timer.remainingSeconds === timer.totalSeconds && (
          <FooterHint text="Press Enter to start timer" />
        )}
      </div>
    );
  }

  // No timer set yet: show preset picker + custom input
  return (
    <div className="p-4 space-y-3">
      {/* Preset pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
        {TIMER_PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.seconds)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all text-white/40 hover:text-white/60"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom H:M:S input */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-white/20 font-medium uppercase tracking-wider mr-1">Custom</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0} max={23}
            value={customH}
            onChange={e => setCustomH(e.target.value)}
            className="w-[40px] bg-white/[0.06] border border-white/10 rounded-lg px-1.5 py-1.5 text-white text-xs font-mono text-center focus:outline-none focus:border-white/25 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-white/20 text-[10px]">h</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0} max={59}
            value={customM}
            onChange={e => setCustomM(e.target.value)}
            className="w-[40px] bg-white/[0.06] border border-white/10 rounded-lg px-1.5 py-1.5 text-white text-xs font-mono text-center focus:outline-none focus:border-white/25 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-white/20 text-[10px]">m</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0} max={59}
            value={customS}
            onChange={e => setCustomS(e.target.value)}
            className="w-[40px] bg-white/[0.06] border border-white/10 rounded-lg px-1.5 py-1.5 text-white text-xs font-mono text-center focus:outline-none focus:border-white/25 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-white/20 text-[10px]">s</span>
        </div>
        <button
          onClick={handleCustomSet}
          className="ml-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/70 hover:text-white transition-colors"
          style={{ background: accent.bg, border: `1px solid ${accent.border}` }}
        >
          Set
        </button>
      </div>

      <FooterHint text="Pick a preset or set custom duration" />
    </div>
  );
}

export { TimerView };
