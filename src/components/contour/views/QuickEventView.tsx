import React, { useState } from 'react';
import { Calendar, Check, ArrowRight, Clock } from 'lucide-react';
import { ModuleData } from '../moduleRegistry';
import { saveQuickEvent } from '../modules/quickEvent';

export function QuickEventView({
    module,
    accent,
}: {
    module: ModuleData;
    accent: any;
}) {
    const event = module.quickEvent;
    const [saved, setSaved] = useState(false);

    if (!event) return null;

    return (
        <div className="p-4 flex flex-col gap-3 mx-2 my-2">
            <div className="flex items-center gap-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0"
                    style={{ background: accent.bg, border: `1px solid ${accent.border}` }}
                >
                    {saved ? <Check className={`w-5 h-5 ${accent.text}`} /> : <Calendar className={`w-5 h-5 ${accent.text}`} />}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{saved ? 'Added to Calendar' : 'New Event'}</h3>
                    {!saved && <p className="text-xs text-white/50 font-mono">Press ↵ to schedule</p>}
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
                <div className="text-base font-semibold text-white truncate">
                    {event.title}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{event.date} • {event.startTime} - {event.endTime}</span>
                </div>
            </div>

            {!saved && (
                <button
                    onClick={() => { saveQuickEvent(event); setSaved(true); }}
                    className="mt-2 w-full py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors"
                    style={{ background: accent.solid }}
                >
                    Add to Calendar <ArrowRight className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}
