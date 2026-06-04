import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Copy, Check, ChevronLeft } from 'lucide-react';
import { Snippet, loadSnippets, saveSnippets } from '../modules/snippetManager';
import { ModuleData } from '../moduleRegistry';

export function SnippetsView({
    accent,
    onCopyValue,
}: {
    module: ModuleData;
    accent: any;
    onCopyValue?: (value: string) => void;
}) {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        setSnippets(loadSnippets());
    }, []);

    const handleSave = () => {
        if (!newTitle.trim() || !newContent.trim()) return;

        let updated: Snippet[];
        if (editingId) {
            updated = snippets.map((s) => (s.id === editingId ? { ...s, title: newTitle, content: newContent } : s));
        } else {
            const newSnippet: Snippet = { id: Date.now().toString(), title: newTitle, content: newContent };
            updated = [newSnippet, ...snippets];
        }

        setSnippets(updated);
        saveSnippets(updated);
        setEditingId(null);
        setNewTitle('');
        setNewContent('');
    };

    const handleDelete = (id: string) => {
        const updated = snippets.filter((s) => s.id !== id);
        setSnippets(updated);
        saveSnippets(updated);
    };

    const handleCopy = (snippet: Snippet) => {
        onCopyValue?.(snippet.content);
        setCopiedId(snippet.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="p-4 space-y-4">
            {editingId !== null ? (
                <div className="space-y-3 animate-fade-in-up">
                    <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => { setEditingId(null); setNewTitle(''); setNewContent(''); }} className="p-1 hover:bg-white/10 rounded-lg text-white/50">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium text-white/80">{editingId === 'new' ? 'New Snippet' : 'Edit Snippet'}</span>
                    </div>
                    <input
                        autoFocus
                        type="text"
                        placeholder="Title (e.g., Code Boilerplate)"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none"
                    />
                    <textarea
                        placeholder="Snippet content..."
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none resize-none custom-scrollbar"
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors"
                            style={{ background: accent.solid }}
                        >
                            Save Snippet
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Your Snippets</span>
                        <button
                            onClick={() => { setEditingId('new'); setNewTitle(''); setNewContent(''); }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/80 transition-colors border border-white/10"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                    </div>

                    <div className="space-y-2">
                        {snippets.length === 0 ? (
                            <div className="text-center py-6 text-white/30 text-xs">No snippets saved yet.</div>
                        ) : (
                            snippets.map((snippet) => (
                                <div key={snippet.id} className="group relative bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleCopy(snippet)}>
                                            <h4 className="text-sm font-medium text-white/90 truncate">{snippet.title}</h4>
                                            <p className="text-xs text-white/40 truncate mt-0.5 font-mono">{snippet.content.substring(0, 60)}{snippet.content.length > 60 ? '...' : ''}</p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleCopy(snippet)} className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                                                {copiedId === snippet.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                            <button onClick={() => { setEditingId(snippet.id); setNewTitle(snippet.title); setNewContent(snippet.content); }} className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDelete(snippet.id)} className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-red-400 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
