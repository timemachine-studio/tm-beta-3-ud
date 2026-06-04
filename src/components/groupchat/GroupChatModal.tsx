import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Copy, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createGroupChat } from '../../services/groupChat/groupChatService';
import { AI_PERSONAS } from '../../config/constants';

interface GroupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  chatName: string;
  persona: keyof typeof AI_PERSONAS;
  onGroupChatCreated?: (chatName: string) => Promise<string | null>;
}

export function GroupChatModal({
  isOpen,
  onClose,
  sessionId,
  chatName,
  persona,
  onGroupChatCreated
}: GroupChatModalProps) {
  const { user, profile } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = shareId ? `${window.location.origin}/groupchat/${shareId}` : '';

  const handleCreateGroupChat = async () => {
    if (!user || !profile) {
      setError('You need to be logged in to create a group chat');
      return;
    }

    setIsCreating(true);
    setError(null);

    // Let parent enable collaborative mode and create the group chat
    // enableCollaborativeMode returns the shareId
    const id = await onGroupChatCreated?.(chatName || 'Group Chat');

    if (id) {
      setShareId(id);
    } else {
      setError('Failed to create group chat. Please try again.');
    }

    setIsCreating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Close modal and navigate to group chat URL for persistence
  const handleContinue = () => {
    onClose();
    if (shareId) {
      window.location.href = `/groupchat/${shareId}`;
    }
  };

  const personaColors = {
    default: 'from-purple-500 to-violet-500',
    girlie: 'from-pink-500 to-rose-500',
    pro: 'from-cyan-500 to-blue-500',
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
                className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 flex items-center justify-center p-4 z-50"
              >
                <div
                  className="relative w-full max-w-md overflow-hidden rounded-3xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  }}
                >
                  {/* Persona gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${personaColors[persona]} opacity-10 rounded-3xl`} />

                  <div className="relative p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-2xl bg-gradient-to-br ${personaColors[persona]} bg-opacity-20`}>
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <Dialog.Title className="text-xl font-semibold text-white">
                          Group Chat
                        </Dialog.Title>
                      </div>
                      <Dialog.Close asChild>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-2 rounded-full"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                          }}
                        >
                          <X className="w-5 h-5 text-white/70" />
                        </motion.button>
                      </Dialog.Close>
                    </div>

                    {!shareId ? (
                      // Create group chat view
                      <div className="space-y-6">
                        <div className="text-center py-4">
                          <div className="inline-flex p-4 rounded-2xl bg-white/5 mb-4">
                            <Users className="w-10 h-10 text-white/50" />
                          </div>
                          <h3 className="text-lg font-medium text-white mb-2">
                            Start a Group Chat
                          </h3>
                          <p className="text-white/50 text-sm">
                            Invite friends to chat together with {AI_PERSONAS[persona].name}.
                            Share the link and anyone can join!
                          </p>
                        </div>

                        <div
                          className="p-4 rounded-2xl"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                          }}
                        >
                          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Chat Name</p>
                          <p className="text-white font-medium">{chatName || 'Untitled Chat'}</p>
                        </div>

                        {error && (
                          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
                            {error}
                          </div>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleCreateGroupChat}
                          disabled={isCreating || !user}
                          className={`w-full py-4 rounded-xl bg-gradient-to-r ${personaColors[persona]} text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50`}
                          style={{
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                          }}
                        >
                          {isCreating ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Users className="w-5 h-5" />
                              Enable Group Chat
                            </>
                          )}
                        </motion.button>

                        {!user && (
                          <p className="text-center text-white/40 text-sm">
                            Sign in to create a group chat
                          </p>
                        )}
                      </div>
                    ) : (
                      // Share link view
                      <div className="space-y-6">
                        <div className="text-center py-4">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="inline-flex p-4 rounded-full bg-green-500/20 mb-4"
                          >
                            <Check className="w-8 h-8 text-green-400" />
                          </motion.div>
                          <h3 className="text-lg font-medium text-white mb-2">
                            Group Chat Created!
                          </h3>
                          <p className="text-white/50 text-sm">
                            Share this link with friends to invite them
                          </p>
                        </div>

                        <div
                          className="p-4 rounded-2xl"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                          }}
                        >
                          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Share Link</p>
                          <p className="text-white font-mono text-sm break-all">{shareUrl}</p>
                        </div>

                        <div className="flex gap-3">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleCopy}
                            className="flex-1 py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                            }}
                          >
                            {copied ? (
                              <>
                                <Check className="w-4 h-4 text-green-400" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copy Link
                              </>
                            )}
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleContinue}
                            className={`flex-1 py-3 rounded-xl bg-gradient-to-r ${personaColors[persona] || personaColors.default} text-white font-medium flex items-center justify-center gap-2`}
                            style={{
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                            }}
                          >
                            <Check className="w-4 h-4" />
                            Continue
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
