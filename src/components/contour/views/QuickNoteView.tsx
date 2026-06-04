import React, { useState } from 'react';
import { FileText, Check, ArrowRight } from 'lucide-react';
import { ModuleData } from '../moduleRegistry';
import { saveQuickNote } from '../modules/quickNote';

export function QuickNoteView({
    module,
    accent,
}: {
    module: ModuleData;
    accent: any;
}) {
    const note = module.quickNote;
    const [saved, setSaved] = useState(false);

    if (!note) return null;

    return (
        <div className="p-4 flex flex-col gap-3 mx-2 my-2">
            <div className="flex items-center gap-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0"
                    style={{ background: accent.bg, border: `1px solid ${accent.border}` }}
                >
                    {saved ? <Check className={`w-5 h-5 ${accent.text}`} /> : <FileText className={`w-5 h-5 ${accent.text}`} />}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{saved ? 'Saved to Quick Notes' : 'New Quick Note'}</h3>
                    {!saved && <p className="text-xs text-white/50 font-mono">Press ↵ to save</p>}
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white/90">
                "{note.content}"
            </div>

            {!saved && (
                <button
                    onClick={() => { saveQuickNote(note.content); setSaved(true); }}
                    className="mt-2 w-full py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors"
                    style={{ background: accent.solid }}
                >
                    Save to Notes <ArrowRight className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}
