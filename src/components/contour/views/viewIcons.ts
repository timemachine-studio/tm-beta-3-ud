import type React from 'react';
import {
  Calculator, ArrowLeftRight, DollarSign, Globe, Palette,
  Timer, Calendar, Shuffle, Type, Braces, Lock, Link, Hash,
  FileSearch, FileText, Settings, History, Image, Brain,
  HelpCircle, Code, Music, HeartPulse, Fingerprint, Clock,
  Search, Wrench, Monitor, Zap, Command,
  Dices, Coins, RefreshCw,
  BookOpen, Mic, AlignLeft, List, MessageSquare, TrendingUp,
} from 'lucide-react';

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

export function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] || Command;
}
