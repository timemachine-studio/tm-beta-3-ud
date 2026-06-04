import React, { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Brain, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMemories, createMemory, deleteMemory, AIMemory } from '../../services/memory/memoryService';

interface MemoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemoriesModal: React.FC<MemoriesModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newMemory, setNewMemory] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getMemories(user.id);
      setMemories(data);
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      loadMemories();
    }
  }, [isOpen, user, loadMemories]);

  const handleAddMemory = async () => {
    if (!user || !newMemory.trim()) return;

    setIsAdding(true);
    try {
      const memory = await createMemory(user.id, {
        content: newMemory.trim(),
        memory_type: 'general',
        importance: 5,
      });
      if (memory) {
        setMemories(prev => [memory, ...prev]);
        setNewMemory('');
      }
    } catch (error) {
      console.error('Failed to add memory:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    setDeletingId(memoryId);
    try {
      const success = await deleteMemory(memoryId);
      if (success) {
        setMemories(prev => prev.filter(m => m.id !== memoryId));
      }
    } catch (error) {
      console.error('Failed to delete memory:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const getMemoryTypeColor = (type: string) => {
    switch (type) {
      case 'preference': return 'from-pink-500/20 to-rose-500/20 border-pink-500/30';
      case 'fact': return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
      case 'instruction': return 'from-amber-500/20 to-orange-500/20 border-amber-500/30';
      default: return 'from-purple-500/20 to-violet-500/20 border-purple-500/30';
    }
  };

  const getMemoryTypeLabel = (type: string) => {
    switch (type) {
      case 'preference': return 'Preference';
      case 'fact': return 'Fact';
      case 'instruction': return 'Instruction';
      default: return 'Memory';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
          <Dialog.Portal>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[60]"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 flex items-center justify-center p-4 z-[60]"
              >
                <div className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-3xl">
                  {/* Glass background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-2xl" />
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10" />
                  <div className="absolute inset-[1px] rounded-3xl border border-white/[0.08]" />

                  <div className="relative p-6 flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
                          <Brain className="w-5 h-5 text-purple-400" />
                        </div>
                        <Dialog.Title className="text-xl font-semibold text-white">
                          Memories
                        </Dialog.Title>
                      </div>
                      <Dialog.Close asChild>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                        >
                          <X className="w-5 h-5 text-white/70" />
                        </motion.button>
                      </Dialog.Close>
                    </div>

                    {/* Add new memory */}
                    <div className="mb-6">
                      <div className="relative">
                        <textarea
                          value={newMemory}
                          onChange={(e) => setNewMemory(e.target.value)}
                          placeholder="Add something you want TimeMachine to remember..."
                          rows={2}
                          className="w-full px-4 py-3 pr-12 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 resize-none transition-all text-sm"
                        />
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={handleAddMemory}
                          disabled={isAdding || !newMemory.trim()}
                          className="absolute right-3 bottom-3 p-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white disabled:opacity-50 transition-all"
                        >
                          {isAdding ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </motion.button>
                      </div>
                    </div>

                    {/* Memories list */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        </div>
                      ) : memories.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="inline-flex p-4 rounded-full bg-white/5 mb-4">
                            <Sparkles className="w-8 h-8 text-white/30" />
                          </div>
                          <p className="text-white/50 text-sm">No memories yet</p>
                          <p className="text-white/30 text-xs mt-1">Add things you want TimeMachine to remember about you</p>
                        </div>
                      ) : (
                        memories.map((memory) => (
                          <motion.div
                            key={memory.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`relative p-4 rounded-2xl bg-gradient-to-r ${getMemoryTypeColor(memory.memory_type)} border backdrop-blur-sm group`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <span className="inline-block px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-medium text-white/60 uppercase tracking-wider mb-2">
                                  {getMemoryTypeLabel(memory.memory_type)}
                                </span>
                                <p className="text-white/90 text-sm leading-relaxed">
                                  {memory.content}
                                </p>
                                <p className="text-white/30 text-[10px] mt-2">
                                  {new Date(memory.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleDeleteMemory(memory.id)}
                                disabled={deletingId === memory.id}
                                className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                              >
                                {deletingId === memory.id ? (
                                  <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </motion.button>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
};

export default MemoriesModal;
