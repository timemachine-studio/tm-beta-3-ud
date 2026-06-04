import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Check, Trash2 } from 'lucide-react';

const glassCard = {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
} as const;

const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
});

interface ShoppingItem {
    id: string;
    name: string;
    done: boolean;
}

function getStorageKey(key: string) {
    return `tm_lifestyle_${key}`;
}

function loadFromStorage<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(getStorageKey(key));
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function saveToStorage<T>(key: string, value: T) {
    try {
        localStorage.setItem(getStorageKey(key), JSON.stringify(value));
    } catch { /* ignore */ }
}

export function ShoppingListPage() {
    const [items, setItems] = useState<ShoppingItem[]>(() => loadFromStorage('shopping_items', []));
    const [newItem, setNewItem] = useState('');

    const persist = (next: ShoppingItem[]) => { setItems(next); saveToStorage('shopping_items', next); };

    const add = () => {
        const name = newItem.trim();
        if (!name) return;
        persist([...items, { id: Date.now().toString(), name, done: false }]);
        setNewItem('');
    };

    const toggle = (id: string) => persist(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
    const remove = (id: string) => persist(items.filter(i => i.id !== id));

    const remaining = items.filter(i => !i.done).length;

    return (
        <div className="px-6 sm:px-10 max-w-4xl mx-auto w-full">
            <motion.div {...fadeUp(0.1)} className="text-center mb-10">
                <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-3">
                    Shopping List
                </h1>
                <p className="text-white/40 text-lg">
                    Keep track of everything you need, beautifully.
                </p>
            </motion.div>

            <motion.div {...fadeUp(0.2)} className="rounded-3xl p-6 sm:p-8" style={glassCard}>
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-300">
                            <ShoppingCart className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-lg tracking-wide">Your Items</h3>
                            {items.length > 0 && (
                                <p className="text-xs font-medium text-white/40 mt-1">
                                    {remaining} remaining • {items.length} total
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Add input */}
                <div className="flex items-center gap-3 mb-8">
                    <div
                        className="flex-1 flex items-center gap-3 px-4 py-4 rounded-2xl"
                        style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        <input
                            type="text"
                            value={newItem}
                            onChange={(e) => setNewItem(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && add()}
                            placeholder="Add an item... (e.g. Milk, Eggs, Bread)"
                            className="flex-1 bg-transparent text-white text-base placeholder:text-white/30 outline-none"
                        />
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={add}
                        className="p-4 rounded-2xl text-white transition-colors flex items-center justify-center shadow-lg"
                        style={{
                            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.8), rgba(139, 92, 246, 0.8))',
                            border: '1px solid rgba(168, 85, 247, 0.4)',
                        }}
                    >
                        <Plus className="w-6 h-6" />
                    </motion.button>
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 pb-4">
                    <AnimatePresence mode="popLayout">
                        {items.map(item => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className={`flex items-center gap-4 px-4 py-4 rounded-2xl group transition-all duration-300 border ${item.done
                                        ? 'bg-white/[0.02] border-white/5 opacity-60'
                                        : 'bg-white/[0.06] border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                                    }`}
                            >
                                <button
                                    onClick={() => toggle(item.id)}
                                    className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 shadow-sm
                    ${item.done
                                            ? 'bg-purple-500 border-purple-400 text-white'
                                            : 'bg-black/20 border-white/20 text-transparent hover:border-white/40'
                                        }`}
                                >
                                    {item.done && <Check className="w-4 h-4" />}
                                </button>
                                <span className={`flex-1 text-base font-medium transition-all duration-200 ${item.done ? 'text-white/40 line-through' : 'text-white/90'}`}>
                                    {item.name}
                                </span>
                                <button
                                    onClick={() => remove(item.id)}
                                    className="opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {items.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-white/20">
                            <div className="p-6 rounded-full bg-white/5 mb-4">
                                <ShoppingCart className="w-12 h-12 opacity-40" />
                            </div>
                            <p className="text-base font-medium text-white/40">Your shopping list is empty</p>
                            <p className="text-sm text-white/20 mt-1">Add something you need to buy above.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
