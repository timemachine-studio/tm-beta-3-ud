import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Brain, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getMemories, createMemory, deleteMemory, AIMemory } from '../../services/memory/memoryService';

export function MemoriesPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
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
    if (user) {
      loadMemories();
    }
  }, [user, loadMemories]);

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

  if (!user) {
    return (
      <div className={`min-h-screen ${theme.background} ${theme.text} flex items-center justify-center`}>
        <div className="text-center">
          <Brain className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60 text-lg">Sign in to view your memories</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-200"
          >
            Go Home
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.background} ${theme.text} relative overflow-hidden`}>
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-pink-500/15 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.05, x: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </motion.button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Memories</h1>
          </div>

          <div className="w-16" />
        </motion.div>

        {/* Add new memory */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="relative">
            <textarea
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              placeholder="Add something you want TimeMachine to remember..."
              rows={3}
              className="w-full px-4 py-4 pr-14 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 resize-none transition-all"
            />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleAddMemory}
              disabled={isAdding || !newMemory.trim()}
              className="absolute right-3 bottom-3 p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white disabled:opacity-50 transition-all"
            >
              {isAdding ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Memories list */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex p-6 rounded-full bg-white/5 mb-6">
                <Sparkles className="w-12 h-12 text-white/30" />
              </div>
              <p className="text-white/50 text-lg">No memories yet</p>
              <p className="text-white/30 text-sm mt-2">Add things you want TimeMachine to remember about you</p>
            </div>
          ) : (
            memories.map((memory, index) => (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`relative p-5 rounded-2xl bg-gradient-to-r ${getMemoryTypeColor(memory.memory_type)} border backdrop-blur-sm group`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-medium text-white/60 uppercase tracking-wider mb-3">
                      {getMemoryTypeLabel(memory.memory_type)}
                    </span>
                    <p className="text-white/90 leading-relaxed">
                      {memory.content}
                    </p>
                    <p className="text-white/30 text-xs mt-3">
                      {new Date(memory.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleDeleteMemory(memory.id)}
                    disabled={deletingId === memory.id}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                  >
                    {deletingId === memory.id ? (
                      <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
