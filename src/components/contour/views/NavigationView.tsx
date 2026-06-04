import React, { useEffect } from 'react';
import { ArrowRight, FileText, HeartPulse, Coffee, ChefHat, Shirt, ShoppingCart, Calendar, Home } from 'lucide-react';
import { ModuleData } from '../moduleRegistry';

const ICON_MAP: Record<string, any> = {
    FileText,
    HeartPulse,
    Coffee,
    ChefHat,
    Shirt,
    ShoppingCart,
    Calendar,
    Home,
};

export function NavigationView({
    module,
    accent,
    onNavigate,
}: {
    module: ModuleData;
    accent: any;
    onNavigate?: (path: string) => void;
}) {
    const nav = module.navigation;
    if (!nav) return null;

    const Icon = ICON_MAP[nav.icon] || ArrowRight;

    return (
        <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors rounded-xl mx-2 my-2" onClick={() => onNavigate?.(nav.path)}>
            <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                style={{ background: accent.bg, border: `1px solid ${accent.border}` }}
            >
                <Icon className={`w-6 h-6 ${accent.text}`} />
            </div>
            <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Navigate to {nav.target.charAt(0).toUpperCase() + nav.target.slice(1)}</h3>
                <p className="text-sm text-white/50 font-mono">Press ↵ to jump instantly</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <ArrowRight className="w-4 h-4 text-white/40" />
            </div>
        </div>
    );
}
