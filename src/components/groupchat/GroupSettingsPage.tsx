import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Settings,
  Users,
  UserMinus,
  LogOut,
  Crown,
  Edit3,
  Check,
  X,
  Trash2,
  Copy,
  Link as LinkIcon,
  Loader2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  getGroupChat,
  disableGroupChat
} from '../../services/groupChat/groupChatService';
import { GroupChat, GroupChatParticipant } from '../../types/groupChat';
import { AI_PERSONAS } from '../../config/constants';
import { supabase } from '../../lib/supabase';

export function GroupSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [groupChat, setGroupChat] = useState<GroupChat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!id || !user) return;

      setIsLoading(true);
      const chat = await getGroupChat(id);

      if (chat) {
        setGroupChat(chat);
        setNewName(chat.name);
        setIsOwner(chat.owner_id === user.id);
      }

      setIsLoading(false);
    }

    loadData();
  }, [id, user]);

  const handleSaveName = async () => {
    if (!groupChat || !newName.trim() || newName === groupChat.name) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);

    const { error } = await supabase
      .from('group_chats')
      .update({ name: newName.trim() })
      .eq('id', groupChat.id);

    if (!error) {
      setGroupChat({ ...groupChat, name: newName.trim() });
    }

    setIsSavingName(false);
    setIsEditingName(false);
  };

  const handleKickMember = async (participantUserId: string) => {
    if (!groupChat || !isOwner) return;

    setKickingUserId(participantUserId);

    const { error } = await supabase
      .from('group_chat_participants')
      .delete()
      .eq('group_chat_id', groupChat.id)
      .eq('user_id', participantUserId);

    if (!error) {
      setGroupChat({
        ...groupChat,
        participants: groupChat.participants.filter(p => p.user_id !== participantUserId)
      });
    }

    setKickingUserId(null);
  };

  const handleLeaveGroup = async () => {
    if (!groupChat || !user) return;

    const { error } = await supabase
      .from('group_chat_participants')
      .delete()
      .eq('group_chat_id', groupChat.id)
      .eq('user_id', user.id);

    if (!error) {
      navigate('/');
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupChat || !user || !isOwner) return;

    setIsDeleting(true);
    const success = await disableGroupChat(groupChat.id, user.id);

    if (success) {
      navigate('/');
    }
    setIsDeleting(false);
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/groupchat/${id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const personaColors = {
    default: 'from-purple-500 to-violet-500',
    girlie: 'from-pink-500 to-rose-500',
    pro: 'from-cyan-500 to-blue-500',
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme.background} flex items-center justify-center`}>
        <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!groupChat) {
    return (
      <div className={`min-h-screen ${theme.background} flex items-center justify-center p-4`}>
        <div className="text-center">
          <p className="text-white/50 text-lg mb-4">Group chat not found</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-200"
          >
            Go Home
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.background}`}>
      {/* Header */}
      <header className="sticky top-0 z-10 px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(`/groupchat/${id}`)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </motion.button>
            <h1 className="text-lg font-semibold text-white">Group Settings</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Group Info Card */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
          }}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${personaColors[groupChat.persona]} opacity-10 rounded-2xl`} />

          <div className="relative p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${personaColors[groupChat.persona]}`}>
                <Settings className="w-6 h-6 text-white" />
              </div>

              <div className="flex-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-purple-500"
                      autoFocus
                    />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleSaveName}
                      disabled={isSavingName}
                      className="p-2 rounded-lg bg-green-500/20 text-green-400"
                    >
                      {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setNewName(groupChat.name);
                        setIsEditingName(false);
                      }}
                      className="p-2 rounded-lg bg-white/10 text-white/50"
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{groupChat.name}</h2>
                    {isOwner && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsEditingName(true)}
                        className="p-1 rounded-lg hover:bg-white/10 text-white/40"
                      >
                        <Edit3 className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                )}
                <p className="text-white/50 text-sm mt-1">
                  {AI_PERSONAS[groupChat.persona].name} · Created by {groupChat.owner_nickname}
                </p>
              </div>
            </div>

            {/* Invite Link */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={copyInviteLink}
              className="w-full flex items-center justify-between p-4 rounded-xl"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
              }}
            >
              <div className="flex items-center gap-3">
                <LinkIcon className="w-5 h-5 text-white/50" />
                <div className="text-left">
                  <p className="text-white font-medium">Invite Link</p>
                  <p className="text-white/40 text-sm">Share to invite others</p>
                </div>
              </div>
              {copied ? (
                <Check className="w-5 h-5 text-green-400" />
              ) : (
                <Copy className="w-5 h-5 text-white/50" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Participants Section */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
          }}
        >
          <div className="relative p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-white/70" />
              <h3 className="text-lg font-semibold text-white">
                Participants ({groupChat.participants.length})
              </h3>
            </div>

            <div className="space-y-2">
              {groupChat.participants.map((participant) => (
                <ParticipantRow
                  key={participant.id}
                  participant={participant}
                  isOwner={isOwner}
                  isCurrentUser={participant.user_id === user?.id}
                  isParticipantOwner={participant.is_owner}
                  isKicking={kickingUserId === participant.user_id}
                  onKick={() => handleKickMember(participant.user_id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="space-y-3">
          {/* Leave Group (for non-owners) */}
          {!isOwner && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLeaveGroup}
              className="w-full flex items-center justify-between p-4 rounded-xl"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-red-400" />
                <span className="text-red-300 font-medium">Leave Group</span>
              </div>
            </motion.button>
          )}

          {/* Delete Group (for owners) */}
          {isOwner && (
            <>
              {showDeleteConfirm ? (
                <div
                  className="p-4 rounded-xl space-y-3"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <p className="text-red-200 text-sm">
                    Are you sure you want to delete this group? This cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDeleteGroup}
                      disabled={isDeleting}
                      className="flex-1 py-2 px-4 rounded-lg bg-red-500 text-white font-medium flex items-center justify-center gap-2"
                      style={{
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                      }}
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete Group
                        </>
                      )}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 px-4 rounded-lg text-white/70 font-medium"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                      }}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-between p-4 rounded-xl"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-5 h-5 text-red-400" />
                    <span className="text-red-300 font-medium">Delete Group</span>
                  </div>
                </motion.button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Participant Row Component
interface ParticipantRowProps {
  participant: GroupChatParticipant;
  isOwner: boolean;
  isCurrentUser: boolean;
  isParticipantOwner: boolean;
  isKicking: boolean;
  onKick: () => void;
}

function ParticipantRow({
  participant,
  isOwner,
  isCurrentUser,
  isParticipantOwner,
  isKicking,
  onKick
}: ParticipantRowProps) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      }}
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden flex-shrink-0">
        {participant.avatar_url ? (
          <img
            src={participant.avatar_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-white font-bold text-lg">
            {participant.nickname.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white font-medium truncate">
            {participant.nickname}
          </p>
          {isCurrentUser && (
            <span className="text-white/40 text-sm">(you)</span>
          )}
          {isParticipantOwner && (
            <Crown className="w-4 h-4 text-yellow-400" />
          )}
        </div>
        <p className="text-white/40 text-sm">
          Joined {new Date(participant.joined_at).toLocaleDateString()}
        </p>
      </div>

      {/* Kick button (only for owner, not for self or other owner) */}
      {isOwner && !isCurrentUser && !isParticipantOwner && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onKick}
          disabled={isKicking}
          className="p-2 rounded-lg text-red-400"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}
        >
          {isKicking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserMinus className="w-4 h-4" />
          )}
        </motion.button>
      )}
    </div>
  );
}
