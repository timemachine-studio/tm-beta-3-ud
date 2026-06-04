import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Camera,
  ArrowLeft,
  LogOut,
  Crown,
  MessageSquare,
  Image as ImageIcon,
  Brain,
  Edit3,
  Check,
  X,
  ChevronRight,
  Sparkles,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  Key,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, uploadImage } from '../../lib/supabase';
import { MemoriesModal } from './MemoriesModal';
import { ImagesModal } from './ImagesModal';

interface AccountPageProps {
  onBack: () => void;
}

// TimeMachine Logo for default avatar
const TimeMachineLogo = () => (
  <svg viewBox="0 0 100 100" className="w-12 h-12 text-purple-400">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
    <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
    <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.7" />
    <path d="M50 20 L50 50 L70 60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="50" cy="50" r="4" fill="currentColor" />
  </svg>
);

export const AccountPage: React.FC<AccountPageProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const { user, profile, updateProfile, signOut, changePassword } = useAuth();
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [aboutMe, setAboutMe] = useState(profile?.about_me || '');
  const [gender, setGender] = useState((profile as any)?.gender || '');
  const [birthDate, setBirthDate] = useState((profile as any)?.birth_date || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showMemories, setShowMemories] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [stats, setStats] = useState<{
    chatCount: number;
    messageCount: number;
    imageCount: number;
    memoryCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user stats
  React.useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        const [chats, messages, images, memories] = await Promise.all([
          supabase.from('chat_sessions').select('id', { count: 'exact' }).eq('user_id', user.id),
          supabase.from('chat_messages').select('id', { count: 'exact' }).eq('user_id', user.id),
          supabase.from('user_images').select('id', { count: 'exact' }).eq('user_id', user.id),
          supabase.from('ai_memories').select('id', { count: 'exact' }).eq('user_id', user.id),
        ]);

        setStats({
          chatCount: chats.count || 0,
          messageCount: messages.count || 0,
          imageCount: images.count || 0,
          memoryCount: memories.count || 0,
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    };

    fetchStats();
  }, [user]);

  const handleSaveField = async (field: string) => {
    setLoading(true);
    setError('');
    setSuccess('');

    const updates: Record<string, string | null> = {};
    if (field === 'nickname') updates.nickname = nickname.trim() || null;
    if (field === 'aboutMe') updates.about_me = aboutMe.trim() || null;
    if (field === 'gender') updates.gender = gender || null;
    if (field === 'birthDate') updates.birth_date = birthDate || null;

    const { error: updateError } = await updateProfile(updates);

    if (updateError) {
      // Check if it's a column not found error
      if (updateError.message?.includes('column') || updateError.message?.includes('schema')) {
        setError('This feature requires a database update. Please contact support.');
      } else {
        setError(updateError.message);
      }
    } else {
      setSuccess('Saved');
      setEditingField(null);
      setTimeout(() => setSuccess(''), 2000);
    }

    setLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    setError('');

    try {
      const result = await uploadImage(file, user.id);
      if (result) {
        await updateProfile({ avatar_url: result.url });
        setSuccess('Avatar updated');
        setTimeout(() => setSuccess(''), 2000);
      } else {
        setError('Failed to upload avatar');
      }
    } catch (err) {
      setError('Error uploading avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Force navigation to home page after sign out
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      // Still navigate even if there's an error
      window.location.href = '/';
    }
  };

  const handleOpenHistory = () => {
    navigate('/history');
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);

    const { error } = await changePassword(oldPassword, newPassword);

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setShowChangePassword(false);
        setPasswordSuccess('');
      }, 2000);
    }

    setPasswordLoading(false);
  };

  // Stat card component
  const StatCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: number;
    onClick?: () => void;
  }> = ({ icon, label, value, onClick }) => (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl p-4 text-left w-full group"
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      }}
    >
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-white/50 text-sm font-medium">{label}</p>
          </div>
        </div>
        {onClick && (
          <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
        )}
      </div>
    </motion.button>
  );

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{
        background: 'linear-gradient(to top, #581c87 0%, #000000 40%, #000000 100%)'
      }}
    >

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-6 pb-24">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <motion.button
              whileHover={{ scale: 1.05, x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">Back</span>
            </motion.button>

            {profile?.is_pro && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                <Crown size={14} className="text-amber-400" />
                <span className="text-amber-400 text-xs font-semibold">PRO</span>
              </div>
            )}
          </motion.div>

          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden mb-6 rounded-3xl"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            }}
          >

            <div className="relative p-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center mb-8">
                <div className="relative">
                  {/* Glass avatar container */}
                  <div
                    className="w-28 h-28 rounded-full p-[2px]"
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    <div
                      className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)'
                      }}
                    >
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <TimeMachineLogo />
                      )}
                    </div>
                  </div>

                  {/* Camera button */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute -bottom-1 -right-1 p-2.5 rounded-full text-white"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    {uploadingAvatar ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Camera size={16} />
                    )}
                  </motion.button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>

                <div className="mt-5 text-center">
                  <h2 className="text-xl font-bold text-white">
                    {profile?.nickname || 'TimeMachine User'}
                  </h2>
                  <p className="text-white/40 text-sm mt-1">{user?.email}</p>
                </div>
              </div>

              {/* Stats Grid */}
              {stats && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <StatCard
                    icon={<MessageSquare size={18} className="text-white/70" />}
                    label="Chats"
                    value={stats.chatCount}
                    onClick={handleOpenHistory}
                  />
                  <StatCard
                    icon={<Sparkles size={18} className="text-white/70" />}
                    label="Messages"
                    value={stats.messageCount}
                  />
                  <StatCard
                    icon={<ImageIcon size={18} className="text-white/70" />}
                    label="Images"
                    value={stats.imageCount}
                    onClick={() => setShowImages(true)}
                  />
                  <StatCard
                    icon={<Brain size={18} className="text-white/70" />}
                    label="Memories"
                    value={stats.memoryCount}
                    onClick={() => setShowMemories(true)}
                  />
                </div>
              )}

              {/* Editable Fields */}
              <div className="space-y-4">
                {/* Nickname */}
                <EditableField
                  label="Nickname"
                  value={nickname}
                  onChange={setNickname}
                  isEditing={editingField === 'nickname'}
                  onEdit={() => setEditingField('nickname')}
                  onSave={() => handleSaveField('nickname')}
                  onCancel={() => {
                    setNickname(profile?.nickname || '');
                    setEditingField(null);
                  }}
                  placeholder="Enter your nickname"
                />

                {/* Bio */}
                <EditableField
                  label="Your Bio"
                  value={aboutMe}
                  onChange={setAboutMe}
                  isEditing={editingField === 'aboutMe'}
                  onEdit={() => setEditingField('aboutMe')}
                  onSave={() => handleSaveField('aboutMe')}
                  onCancel={() => {
                    setAboutMe(profile?.about_me || '');
                    setEditingField(null);
                  }}
                  placeholder="Tell TimeMachine about yourself..."
                  multiline
                />

                {/* Gender */}
                <div className="relative">
                  <label className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2 block">
                    Gender
                  </label>
                  <div className="relative">
                    {editingField === 'gender' ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-purple-500/50 text-white focus:outline-none appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-gray-900">Prefer not to say</option>
                          <option value="male" className="bg-gray-900">Male</option>
                          <option value="female" className="bg-gray-900">Female</option>
                          <option value="non-binary" className="bg-gray-900">Non-binary</option>
                          <option value="other" className="bg-gray-900">Other</option>
                        </select>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleSaveField('gender')}
                          className="p-2.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-all"
                        >
                          <Check size={16} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setGender((profile as any)?.gender || '');
                            setEditingField(null);
                          }}
                          className="p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
                        >
                          <X size={16} />
                        </motion.button>
                      </div>
                    ) : (
                      <motion.button
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                        onClick={() => setEditingField('gender')}
                        className="w-full px-4 py-3 rounded-xl text-left flex items-center justify-between group"
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        <span className={gender ? 'text-white' : 'text-white/30'}>
                          {gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : 'Not set'}
                        </span>
                        <Edit3 size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Birth Date */}
                <div className="relative">
                  <label className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2 block">
                    Birth Date
                  </label>
                  <div className="relative">
                    {editingField === 'birthDate' ? (
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                          <input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-purple-500/50 text-white focus:outline-none [color-scheme:dark]"
                          />
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleSaveField('birthDate')}
                          className="p-2.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-all"
                        >
                          <Check size={16} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setBirthDate((profile as any)?.birth_date || '');
                            setEditingField(null);
                          }}
                          className="p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
                        >
                          <X size={16} />
                        </motion.button>
                      </div>
                    ) : (
                      <motion.button
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                        onClick={() => setEditingField('birthDate')}
                        className="w-full px-4 py-3 rounded-xl text-left flex items-center justify-between group"
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Calendar size={16} className="text-white/40" />
                          <span className={birthDate ? 'text-white' : 'text-white/30'}>
                            {birthDate ? new Date(birthDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}
                          </span>
                        </div>
                        <Edit3 size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2 block">
                    Email
                  </label>
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <Mail size={16} className="text-white/40" />
                    <span className="text-white/60">{user?.email || 'No email'}</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <AnimatePresence>
                {(error || success) && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`mt-4 p-3 rounded-xl text-sm font-medium ${
                      error
                        ? 'bg-red-500/20 border border-red-500/30 text-red-200'
                        : 'bg-green-500/20 border border-green-500/30 text-green-200'
                    }`}
                  >
                    {error || success}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Change Password Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setShowChangePassword(true)}
            className="w-full py-4 rounded-2xl text-white/80 font-medium flex items-center justify-center gap-2 mb-3"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            }}
          >
            <Key size={18} />
            Change Password
          </motion.button>

          {/* Sign Out Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleSignOut}
            className="w-full py-4 rounded-2xl text-red-400 font-medium flex items-center justify-center gap-2"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            }}
          >
            <LogOut size={18} />
            Sign Out
          </motion.button>

          {/* Account Info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-white/20 text-xs mt-6"
          >
            Member since {new Date(profile?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </motion.p>
        </div>
      </div>

      {/* Modals */}
      <MemoriesModal
        isOpen={showMemories}
        onClose={() => setShowMemories(false)}
      />

      <ImagesModal
        isOpen={showImages}
        onClose={() => setShowImages(false)}
      />

      {/* Change Password Modal */}
      <AnimatePresence>
        {showChangePassword && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
              onClick={() => {
                setShowChangePassword(false);
                setPasswordError('');
                setPasswordSuccess('');
                setOldPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                className="relative w-full max-w-[400px] rounded-3xl p-6"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                }}
              >
                {/* Close button */}
                <button
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordError('');
                    setPasswordSuccess('');
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={20} className="text-white/50" />
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Lock size={24} className="text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-1">Change Password</h3>
                  <p className="text-white/50 text-sm">Enter your current and new password</p>
                </div>

                {/* Form */}
                <div className="space-y-4">
                  {/* Current Password */}
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPasswordFields ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full pl-12 pr-12 py-3.5 rounded-xl text-white placeholder-white/30 focus:outline-none transition-all text-[15px]"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordFields(!showPasswordFields)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 transition-colors"
                    >
                      {showPasswordFields ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* New Password */}
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                      <Key size={18} />
                    </div>
                    <input
                      type={showPasswordFields ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-white/30 focus:outline-none transition-all text-[15px]"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    />
                  </div>

                  {/* Confirm New Password */}
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                      <Key size={18} />
                    </div>
                    <input
                      type={showPasswordFields ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-white/30 focus:outline-none transition-all text-[15px]"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    />
                  </div>

                  {/* Error/Success Messages */}
                  {passwordError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                    >
                      {passwordError}
                    </motion.div>
                  )}
                  {passwordSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm"
                    >
                      {passwordSuccess}
                    </motion.div>
                  )}

                  {/* Submit Button */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleChangePassword}
                    disabled={passwordLoading || !oldPassword || !newPassword || !confirmNewPassword}
                    className="w-full py-3.5 rounded-xl text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[15px]"
                    style={{
                      background: 'rgba(168, 85, 247, 0.3)',
                      border: '1px solid rgba(168, 85, 247, 0.5)',
                      boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2)'
                    }}
                  >
                    {passwordLoading ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin mx-auto" />
                    ) : (
                      'Update Password'
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Editable field component
interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
  multiline?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  onChange,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  placeholder,
  multiline,
}) => (
  <div className="relative">
    <label className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2 block">
      {label}
    </label>
    <div className="relative">
      {isEditing ? (
        <div className="flex gap-2">
          {multiline ? (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-purple-500/50 text-white placeholder-white/30 focus:outline-none resize-none transition-all"
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-purple-500/50 text-white placeholder-white/30 focus:outline-none transition-all"
            />
          )}
          <div className={`flex ${multiline ? 'flex-col' : ''} gap-2`}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSave}
              className="p-2.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-all"
            >
              <Check size={16} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCancel}
              className="p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
            >
              <X size={16} />
            </motion.button>
          </div>
        </div>
      ) : (
        <motion.button
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          onClick={onEdit}
          className="w-full px-4 py-3 rounded-xl text-left flex items-center justify-between group"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}
        >
          <span className={value ? 'text-white' : 'text-white/30'}>
            {value || placeholder || 'Not set'}
          </span>
          <Edit3 size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
        </motion.button>
      )}
    </div>
  </div>
);

export default AccountPage;
