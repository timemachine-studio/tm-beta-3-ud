import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Palette, Info, Mail } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { seasonThemes } from '../../themes/seasons';

export function SettingsPage() {
  const navigate = useNavigate();
  const { theme, mode, season, setMode, setSeason, defaultTheme, setDefaultTheme, clearDefaultTheme } = useTheme();
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (confirmationMessage) {
      const timer = setTimeout(() => setConfirmationMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmationMessage]);

  const seasonButtons = React.useMemo(
    () =>
      Object.entries(seasonThemes)
        .filter(([key]) => key !== 'monochrome')
        .map(([key, seasonTheme]) => (
          <motion.div
            key={key}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center"
          >
            <button
              onClick={() => setSeason(key as keyof typeof seasonThemes)}
              className={`w-16 h-16 rounded-full
                ${seasonTheme.background} bg-opacity-20 backdrop-blur-md
                border-2 border-white/20
                ${season === key ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-transparent' : ''}
                hover:bg-opacity-30 relative group transition-all duration-200`}
              aria-label={`Select ${seasonTheme.name} theme`}
            >
              {season === key && (
                <Palette className="w-5 h-5 text-white/80 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              )}
            </button>
            <span className="text-xs font-medium mt-2 text-center text-white/80">
              {seasonTheme.name}
            </span>
          </motion.div>
        )),
    [season, setSeason]
  );

  return (
    <div className={`min-h-screen ${theme.background} ${theme.text} relative overflow-y-auto`}>
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-pink-500/15 rounded-full blur-[100px] animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[150px]" />
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

          <h1 className="text-2xl font-bold text-white">Settings</h1>

          <div className="w-16" /> {/* Spacer for centering */}
        </motion.div>

        {/* Confirmation Message */}
        <AnimatePresence>
          {confirmationMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 text-sm font-medium text-center"
            >
              {confirmationMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl"
        >
          {/* Glass background */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/5" />
          <div className="absolute inset-[1px] rounded-3xl border border-white/[0.08]" />

          <div className="relative p-6 space-y-8">
            {/* Appearance Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Appearance</h2>

              {/* Monochrome Toggle */}
              <div className="space-y-3">
                <div
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Palette className="w-5 h-5 text-white/60" />
                    <div>
                      <p className="text-sm font-medium text-white">Monochrome Mode</p>
                      <p className="text-xs text-white/50">Black and white theme</p>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setMode(mode === 'monochrome' ? 'dark' : 'monochrome')}
                    className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${
                      mode === 'monochrome' ? 'bg-purple-500' : 'bg-white/20'
                    }`}
                    style={{
                      boxShadow: mode === 'monochrome'
                        ? '0 0 20px rgba(168, 85, 247, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        : 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <motion.div
                      className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg"
                      animate={{ left: mode === 'monochrome' ? '26px' : '4px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </motion.button>
                </div>
              </div>

              {/* Default Theme Section */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-white/60">Default Theme</label>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <span className="text-sm text-white/80">
                      {defaultTheme
                        ? `${defaultTheme.mode.charAt(0).toUpperCase() + defaultTheme.mode.slice(1)}${
                            defaultTheme.season ? `, ${seasonThemes[defaultTheme.season]?.name || defaultTheme.season}` : ''
                          }`
                        : 'No default theme set'}
                    </span>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setDefaultTheme({ mode, season });
                          setConfirmationMessage(defaultTheme ? 'Default theme changed!' : 'Default theme set!');
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium
                          bg-purple-500/20 hover:bg-purple-500/30
                          border border-purple-500/30
                          text-purple-200 transition-all duration-200"
                      >
                        {defaultTheme ? 'Change' : 'Set Default'}
                      </motion.button>
                      {defaultTheme && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            clearDefaultTheme();
                            setConfirmationMessage('Default theme cleared!');
                          }}
                          className="px-4 py-2 rounded-lg text-sm font-medium
                            bg-red-500/20 hover:bg-red-500/30
                            border border-red-500/30
                            text-red-200 transition-all duration-200"
                        >
                          Clear
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Season Themes */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Seasons</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                {seasonButtons}
              </div>
            </div>

            {/* About & Contact Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">More</h2>
              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate('/about')}
                  className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  }}
                >
                  <Info className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-sm font-medium text-white">About Us</p>
                    <p className="text-xs text-white/50">Learn more about TimeMachine</p>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate('/contact')}
                  className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  }}
                >
                  <Mail className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-sm font-medium text-white">Contact with Us</p>
                    <p className="text-xs text-white/50">Get in touch with our team</p>
                  </div>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* App Info */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-white/20 text-xs mt-8"
        >
          TimeMachine v1.0
        </motion.p>
      </div>
    </div>
  );
}
