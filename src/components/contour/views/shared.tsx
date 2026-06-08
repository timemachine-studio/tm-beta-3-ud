/**
 * Shared UI primitives and constants for Contour module views.
 */

import React from 'react';
import {
  Calculator, ArrowLeftRight, DollarSign, Globe, Palette,
  Timer, Calendar, Shuffle, Type, Braces, Lock, Link, Hash,
  FileSearch, FileText, Settings, History, Image, Brain,
  HelpCircle, Code, Music, HeartPulse, Fingerprint, Clock,
  Search, Wrench, Monitor, Zap, Command,
  Dices, Coins, RefreshCw,
  BookOpen, Mic, AlignLeft, List, MessageSquare, TrendingUp,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────

export interface AccentTheme {
  bg: string;
  border: string;
  glow: string;
  text: string;
  solid: string;
}

// ─── Constants ─────────────────────────────────────────────────

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Calculator, ArrowLeftRight, DollarSign, Globe, Palette,
  Timer, Calendar, Shuffle, Type, Braces, Lock, Link, Hash,
  FileSearch, FileText, Settings, History, Image, Brain,
  HelpCircle, Code, Music, HeartPulse, Fingerprint, Clock,
  Search, Wrench, Monitor, Zap, Command,
  Dices, Coins, RefreshCw,
  BookOpen, Mic, AlignLeft, List, MessageSquare, TrendingUp,
  // Aliases for icons not in lucide-react 0.344.0
  Languages: Globe,
  LetterText: Type,
  RemoveFormatting: Hash,
};

export const SELECT_ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`;

// ─── Shared Components ─────────────────────────────────────────

export function IconBadge({ icon: Icon, accent }: { icon: React.ComponentType<{ className?: string }>; accent: AccentTheme }) {
  return (
    <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: accent.bg, border: `1px solid ${accent.border}` }}>
      <Icon className={`w-5 h-5 ${accent.text}`} />
    </div>
  );
}

export function HintView({ icon: Icon, accent, text }: { icon: React.ComponentType<{ className?: string }>; accent: AccentTheme; text: string }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <IconBadge icon={Icon} accent={accent} />
        <div className="text-white/30 text-sm">{text}</div>
      </div>
    </div>
  );
}

export function FooterHint({ text }: { text: string }) {
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
      <span className="text-[10px] text-white/20">{text}</span>
    </div>
  );
}

export function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] || Command;
}
