import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Pencil, Trash2, ChevronLeft, ChevronRight, Download, Upload, Cloud, CloudOff, RefreshCw, Users } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AI_PERSONAS } from '../../config/constants';
import {
  ChatSession,
  getLocalSessions,
  getSupabaseSessions,
  deleteSupabaseSession,
  deleteLocalSession,
  renameSupabaseSession,
  migrateLocalSessionsToSupabase,
  saveSupabaseSession,
} from '../../services/chat/chatService';
import { getUserGroupChats } from '../../services/groupChat/groupChatService';

interface GroupChatItem {
  id: string;
  name: string;
  persona: string;
  owner_nickname: string;
  updated_at: string;
  participant_count: number;
}

// Only show TimeMachine personas in tabs (not external AI)
const HISTORY_TABS = {
  default: { name: 'TimeMachine Air' },
  girlie: { name: 'TimeMachine Girlie' },
  pro: { name: 'TimeMachine PRO' },
  groupChats: { name: 'Group Chats' }
} as const;

type HistoryTabKey = keyof typeof HISTORY_TABS;

interface ChatHistoryPageProps {
  onLoadChat: (session: ChatSession) => void;
}

export function ChatHistoryPage({ onLoadChat }: ChatHistoryPageProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChatItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [selectedTab, setSelectedTab] = useState<HistoryTabKey>('default');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const tabKeys = Object.keys(HISTORY_TABS) as HistoryTabKey[];
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadChatSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      let sessions: ChatSession[];

      if (user) {
        // Load regular chat sessions
        sessions = await getSupabaseSessions(user.id);
        // Load group chats
        const userGroupChats = await getUserGroupChats(user.id);
        setGroupChats(userGroupChats);
      } else {
        sessions = getLocalSessions();
        setGroupChats([]);
      }

      setChatSessions(sessions.sort((a, b) =>
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      ));
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      setChatSessions([]);
      setGroupChats([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadChatSessions();
  }, [loadChatSessions]);

  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  const handleMigrateToCloud = async () => {
    if (!user) return;

    setIsSyncing(true);
    try {
      const count = await migrateLocalSessionsToSupabase(user.id);
      if (count > 0) {
        setFeedbackMessage({ type: 'success', text: `Migrated ${count} chat(s) to cloud!` });
        await loadChatSessions();
      } else {
        setFeedbackMessage({ type: 'success', text: 'No local chats to migrate.' });
      }
    } catch (error) {
      setFeedbackMessage({ type: 'error', text: 'Failed to migrate chats.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRename = (sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setEditingId(sessionId);
      setEditingName(session.name);
    }
  };

  const handleSaveRename = async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      if (user) {
        await renameSupabaseSession(editingId, editingName.trim());
      } else {
        const sessions = getLocalSessions();
        const updated = sessions.map(s =>
          s.id === editingId ? { ...s, name: editingName.trim(), lastModified: new Date().toISOString() } : s
        );
        localStorage.setItem('chatSessions', JSON.stringify(updated));
      }

      setChatSessions(prev =>
        prev.map(session =>
          session.id === editingId
            ? { ...session, name: editingName.trim(), lastModified: new Date().toISOString() }
            : session
        )
      );
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to rename chat session:', error);
      setFeedbackMessage({ type: 'error', text: 'Failed to rename chat.' });
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this chat session?')) return;

    try {
      if (user) {
        await deleteSupabaseSession(sessionId);
      } else {
        deleteLocalSession(sessionId);
      }

      setChatSessions(prev => prev.filter(session => session.id !== sessionId));
      setFeedbackMessage({ type: 'success', text: 'Chat deleted.' });
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      setFeedbackMessage({ type: 'error', text: 'Failed to delete chat.' });
    }
  };

  const handleExportChats = () => {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        sessions: chatSessions
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);

        if (!importData.sessions || !Array.isArray(importData.sessions)) {
          throw new Error('Invalid file format');
        }

        const validSessions = importData.sessions.filter((session: any) => {
          return session.id && session.name && session.messages &&
                 session.persona && session.createdAt && session.lastModified &&
                 Array.isArray(session.messages);
        });

        if (validSessions.length === 0) {
          throw new Error('No valid chat sessions found in file');
        }

        if (user) {
          for (const session of validSessions) {
            await saveSupabaseSession(session, user.id);
          }
        } else {
          const existingSessions = getLocalSessions();
          const sessionMap = new Map();

          existingSessions.forEach((session) => {
            sessionMap.set(session.id, session);
          });

          validSessions.forEach((session: ChatSession) => {
            const existing = sessionMap.get(session.id);
            if (!existing || new Date(session.lastModified) > new Date(existing.lastModified)) {
              sessionMap.set(session.id, session);
            }
          });

          const mergedSessions = Array.from(sessionMap.values());
          localStorage.setItem('chatSessions', JSON.stringify(mergedSessions));
        }

        await loadChatSessions();

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
  };

  const handleLoadGroupChat = (groupChatId: string) => {
    // Navigate to the group chat URL
    navigate(`/groupchat/${groupChatId}`);
  };

  const handleTabChange = (direction: 'next' | 'prev') => {
    const currentIndex = tabKeys.indexOf(selectedTab);
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % tabKeys.length
      : (currentIndex - 1 + tabKeys.length) % tabKeys.length;
    setSelectedTab(tabKeys[newIndex]);
  };

  // Filter sessions based on selected tab (excludes group chats - they're handled separately)
  const filteredSessions = selectedTab === 'groupChats'
    ? []
    : chatSessions.filter(session => session.persona === selectedTab);

  const hasLocalSessions = user && getLocalSessions().length > 0;

  return (
    <div
      className="h-screen overflow-y-auto text-white"
      style={{
        background: 'linear-gradient(to top, #581c87 0%, #000000 40%, #000000 100%)'
      }}
    >
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
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

          <h1 className="text-2xl font-bold text-white">Chat History</h1>

          {/* Cloud sync indicator */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30">
                <Cloud className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400">Synced</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
                <CloudOff className="w-4 h-4 text-white/50" />
                <span className="text-xs text-white/50">Local only</span>
              </div>
            )}
          </div>
        </motion.div>

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

        {/* Migration prompt */}
        {hasLocalSessions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-lg bg-purple-500/20 border border-purple-500/30"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-purple-200">
                You have local chats. Migrate them to the cloud?
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleMigrateToCloud}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Cloud className="w-4 h-4" />
                )}
                Migrate
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Export/Import Buttons */}
        <div className="flex gap-2 mb-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExportChats}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-all duration-200"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Export All</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleImportChats}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-all duration-200"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">Import</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadChatSessions}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-all duration-200 disabled:opacity-50"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </motion.button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Tabs */}
        <Tabs.Root
          value={selectedTab}
          onValueChange={(value) => setSelectedTab(value as HistoryTabKey)}
          className="flex flex-col"
        >
          <Tabs.List className="mb-6">
            <div className="sm:hidden flex items-center justify-between">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleTabChange('prev')}
                className="p-2 rounded-full transition-all duration-200"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <ChevronLeft className="w-5 h-5 text-gray-200" />
              </motion.button>
              <motion.div
                key={selectedTab}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-4 py-2 rounded-full text-white text-sm font-medium flex items-center gap-2"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                {selectedTab === 'groupChats' && <Users className="w-4 h-4" />}
                {HISTORY_TABS[selectedTab].name}
              </motion.div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleTabChange('next')}
                className="p-2 rounded-full transition-all duration-200"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <ChevronRight className="w-5 h-5 text-gray-200" />
              </motion.button>
            </div>
            <div className="hidden sm:flex space-x-2 overflow-x-auto">
              {Object.entries(HISTORY_TABS).map(([key, tab]) => (
                <Tabs.Trigger
                  key={key}
                  value={key}
                  className="px-4 py-2 rounded-full transition-all duration-300 text-sm font-medium whitespace-nowrap flex items-center gap-2"
                  style={{
                    background: selectedTab === key ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: selectedTab === key ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: selectedTab === key ? '#fff' : 'rgba(255, 255, 255, 0.7)'
                  }}
                >
                  {key === 'groupChats' && <Users className="w-4 h-4" />}
                  {tab.name}
                </Tabs.Trigger>
              ))}
            </div>
          </Tabs.List>

          <motion.div
            key={selectedTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            ) : selectedTab === 'groupChats' ? (
              // Render group chats
              groupChats.length === 0 ? (
                <div className="text-center py-12 text-white opacity-70">
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-6xl opacity-30">👥</div>
                    <div>
                      <p className="text-lg mb-2">No group chats found</p>
                      <p className="text-sm opacity-50">
                        {user
                          ? 'Group chats will appear here when you create or join them'
                          : 'Sign in to access group chats'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                groupChats.map(chat => (
                  <motion.div
                    key={chat.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl cursor-pointer transition-all duration-300 hover:bg-white/10"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                    onClick={() => handleLoadGroupChat(chat.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-400" />
                          <h3 className="font-semibold text-white truncate text-lg">
                            {chat.name || 'Untitled Group'}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-300 opacity-70 mt-1">
                          {chat.participant_count} participants • by {chat.owner_nickname} • {formatDate(chat.updated_at)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-12 text-white opacity-70">
                <div className="flex flex-col items-center gap-4">
                  <div className="text-6xl opacity-30">💭</div>
                  <div>
                    <p className="text-lg mb-2">No chats found for {HISTORY_TABS[selectedTab].name}</p>
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
                  className="p-4 rounded-xl cursor-pointer transition-all duration-300"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
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
                            className="w-full px-4 py-2 rounded-lg bg-white/10 text-white
                              border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-400
                              text-sm font-medium"
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
                            className="px-4 py-2 rounded-lg text-white text-sm font-medium self-start transition-all duration-200"
                            style={{
                              background: 'rgba(255, 255, 255, 0.15)',
                              border: '1px solid rgba(255, 255, 255, 0.2)'
                            }}
                          >
                            Save
                          </motion.button>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-semibold text-white truncate text-lg">
                            {session.name || 'Untitled Chat'}
                          </h3>
                          <p className="text-sm text-gray-300 opacity-70 mt-1">
                            {session.messages?.length || 0} messages • {formatDate(session.lastModified)}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRename(session.id);
                        }}
                        className="p-2 rounded-full transition-all duration-200"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                        title="Rename"
                      >
                        <Pencil className="w-5 h-5 text-gray-200" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(session.id);
                        }}
                        className="p-2 rounded-full transition-all duration-200 hover:bg-red-500/20"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
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
      </div>
    </div>
  );
}
