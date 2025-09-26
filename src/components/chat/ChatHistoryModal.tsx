import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Trash2, ChevronLeft, ChevronRight, Download, Upload } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Message } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';

interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  persona: keyof typeof AI_PERSONAS;
  createdAt: string;
  lastModified: string;
}

interface ChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadChat: (session: ChatSession) => void;
}

export function ChatHistoryModal({ isOpen, onClose, onLoadChat }: ChatHistoryModalProps) {
  const { theme } = useTheme();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [selectedPersona, setSelectedPersona] = useState<keyof typeof AI_PERSONAS>('default');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const personaKeys = Object.keys(AI_PERSONAS) as (keyof typeof AI_PERSONAS)[];
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadChatSessions();
  }, []);

  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  const loadChatSessions = () => {
    try {
      const sessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
      setChatSessions(sessions.sort((a: ChatSession, b: ChatSession) => 
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      ));
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      setChatSessions([]);
    }
  };

  const handleRename = (sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setEditingId(sessionId);
      setEditingName(session.name);
    }
  };

  const handleSaveRename = () => {
    if (!editingId || !editingName.trim()) return;

    try {
      const updatedSessions = chatSessions.map(session =>
        session.id === editingId
          ? { ...session, name: editingName.trim(), lastModified: new Date().toISOString() }
          : session
      );

      localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));
      setChatSessions(updatedSessions);
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to rename chat session:', error);
    }
  };

  const handleDelete = (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this chat session?')) return;

    try {
      const updatedSessions = chatSessions.filter(session => session.id !== sessionId);
      localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));
      setChatSessions(updatedSessions);
    } catch (error) {
      console.error('Failed to delete chat session:', error);
    }
  };

  const handleExportChats = () => {
    try {
      const allSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        sessions: allSessions
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `timemachine_chat_history_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(link.href);
      setFeedbackMessage({ type: 'success', text: 'Chat history exported successfully!' });
    } catch (error) {
      console.error('Failed to export chat history:', error);
      setFeedbackMessage({ type: 'error', text: 'Failed to export chat history.' });
    }
  };

  const handleImportChats = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);
        
        // Validate the structure
        if (!importData.sessions || !Array.isArray(importData.sessions)) {
          throw new Error('Invalid file format');
        }

        // Validate each session
        const validSessions = importData.sessions.filter((session: any) => {
          return session.id && session.name && session.messages && 
                 session.persona && session.createdAt && session.lastModified &&
                 Array.isArray(session.messages);
        });

        if (validSessions.length === 0) {
          throw new Error('No valid chat sessions found in file');
        }

        // Merge with existing sessions
        const existingSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
        const sessionMap = new Map();

        // Add existing sessions to map
        existingSessions.forEach((session: ChatSession) => {
          sessionMap.set(session.id, session);
        });

        // Add/update with imported sessions (keep newer version based on lastModified)
        validSessions.forEach((session: ChatSession) => {
          const existing = sessionMap.get(session.id);
          if (!existing || new Date(session.lastModified) > new Date(existing.lastModified)) {
            sessionMap.set(session.id, session);
          }
        });

        const mergedSessions = Array.from(sessionMap.values());
        localStorage.setItem('chatSessions', JSON.stringify(mergedSessions));
        loadChatSessions();
        
        setFeedbackMessage({ 
          type: 'success', 
          text: `Successfully imported ${validSessions.length} chat session(s)!` 
        });
      } catch (error) {
        console.error('Failed to import chat history:', error);
        setFeedbackMessage({ 
          type: 'error', 
          text: 'Failed to import chat history. Please check the file format.' 
        });
      }
    };

    reader.readAsText(file);
    // Reset the input
    event.target.value = '';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleLoadChat = (session: ChatSession) => {
    onLoadChat(session);
    onClose();
  };

  const handlePersonaChange = (direction: 'next' | 'prev') => {
    const currentIndex = personaKeys.indexOf(selectedPersona);
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % personaKeys.length
      : (currentIndex - 1 + personaKeys.length) % personaKeys.length;
    setSelectedPersona(personaKeys[newIndex]);
  };

  const filteredSessions = chatSessions.filter(session => session.persona === selectedPersona);

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
                className={`fixed inset-0 ${theme.modal.overlay} backdrop-blur-xl z-50`}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="fixed inset-0 flex items-center justify-center p-4 z-50"
              >
                <div
                  className={`relative w-[95vw] max-w-[700px] h-[90vh] max-h-[85vh] p-6 sm:p-10 rounded-2xl
                    bg-gradient-to-b from-white/3 to-white/1 backdrop-blur-3xl bg-opacity-5
                    border border-white/10 shadow-[0_0_40px_rgba(139,92,246,0.1)] flex flex-col`}
                  style={{ fontFamily: '"Inter", system-ui, sans-serif' }}
                >
                  <Dialog.Title className={`text-2xl font-bold mb-6 text-white tracking-tight`}>
                    Chat History
                  </Dialog.Title>

                  {/* Feedback Message */}
                  <AnimatePresence>
                    {feedbackMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`mb-4 p-3 rounded-lg text-sm font-medium ${
                          feedbackMessage.type === 'success' 
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        {feedbackMessage.text}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Export/Import Buttons */}
                  <div className="flex gap-2 mb-6">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleExportChats}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg
                        bg-white/10 hover:bg-white/20 text-white
                        border border-white/20 transition-all duration-200"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm font-medium">Export All Chats</span>
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleImportChats}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg
                        bg-white/10 hover:bg-white/20 text-white
                        border border-white/20 transition-all duration-200"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="text-sm font-medium">Import Chats</span>
                    </motion.button>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>

                  <Tabs.Root
                    value={selectedPersona}
                    onValueChange={(value) => setSelectedPersona(value as keyof typeof AI_PERSONAS)}
                    className="flex flex-col flex-1 min-h-0"
                  >
                    <Tabs.List className="mb-6">
                      <div className="sm:hidden flex items-center justify-between">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handlePersonaChange('prev')}
                          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200"
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-200" />
                        </motion.button>
                        <motion.div
                          key={selectedPersona}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.15, ease: 'easeInOut' }}
                          className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-medium
                            border border-transparent bg-clip-padding
                            shadow-[0_0_10px_rgba(139,92,246,0.4),0_0_20px_rgba(139,92,246,0.2)]"
                        >
                          {AI_PERSONAS[selectedPersona].name}
                        </motion.div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handlePersonaChange('next')}
                          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200"
                        >
                          <ChevronRight className="w-5 h-5 text-gray-200" />
                        </motion.button>
                      </div>
                      <div className="hidden sm:flex space-x-2 overflow-x-auto">
                        {Object.entries(AI_PERSONAS).map(([key, persona]) => (
                          <Tabs.Trigger
                            key={key}
                            value={key}
                            className={`px-4 py-2 rounded-full transition-all duration-300 text-sm font-medium whitespace-nowrap
                              ${selectedPersona === key
                                ? `bg-gradient-to-r from-purple-500 to-indigo-500 text-white
                                   border border-transparent bg-clip-padding
                                   shadow-[0_0_10px_rgba(139,92,246,0.4),0_0_20px_rgba(139,92,246,0.2)]`
                                : `bg-white/5 hover:bg-white/10 text-gray-200`
                              }`}
                          >
                            {persona.name}
                          </Tabs.Trigger>
                        ))}
                      </div>
                    </Tabs.List>

                    <motion.div
                      key={selectedPersona}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 min-h-0 overflow-y-auto space-y-3"
                    >
                      {filteredSessions.length === 0 ? (
                        <div className={`text-center py-12 text-white opacity-70 text-lg font-light`}>
                          <div className="flex flex-col items-center gap-4">
                            <div className="text-6xl opacity-30">💭</div>
                            <div>
                              <p className="text-lg mb-2">No chats found for {AI_PERSONAS[selectedPersona].name}</p>
                              <p className="text-sm opacity-50">Start a conversation to see your chat history here</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        filteredSessions.map(session => (
                          <motion.div
                            key={session.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`p-4 rounded-xl bg-white/5 border border-white/10
                              transition-all duration-300 hover:bg-gradient-to-r hover:from-white/10 hover:to-purple-500/10
                              cursor-pointer shadow-sm hover:shadow-lg`}
                            onClick={() => handleLoadChat(session)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                {editingId === session.id ? (
                                  <div className="flex flex-col gap-2">
                                    <input
                                      type="text"
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                                      className={`w-full px-4 py-2 rounded-lg bg-white/10 text-white
                                        border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-400
                                        text-sm font-medium`}
                                      autoFocus
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveRename();
                                      }}
                                      className={`px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white
                                        text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 self-start`}
                                    >
                                      Save
                                    </motion.button>
                                  </div>
                                ) : (
                                  <>
                                    <h3 className={`font-semibold text-white truncate text-lg tracking-tight`}>
                                      {session.name || 'Untitled Chat'}
                                    </h3>
                                    <p className={`text-sm text-gray-300 opacity-70 font-light mt-1`}>
                                      Last modified: {formatDate(session.lastModified)}
                                    </p>
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <motion.button
                                  whileHover={{ scale: 1.1, rotate: 5 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRename(session.id);
                                  }}
                                  className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200`}
                                  title="Rename"
                                >
                                  <Pencil className="w-5 h-5 text-gray-200" />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1, rotate: 5 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(session.id);
                                  }}
                                  className={`p-2 rounded-full bg-white/10 hover:bg-red-500/30 transition-all duration-200`}
                                  title="Delete"
                                >
                                  <Trash2 className="w-5 h-5 text-gray-200" />
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </motion.div>
                  </Tabs.Root>

                  <Dialog.Close asChild>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className={`absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200`}
                    >
                      <X className="w-5 h-5 text-gray-200" />
                    </motion.button>
                  </Dialog.Close>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
