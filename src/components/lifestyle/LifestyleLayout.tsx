import React, { useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, ShoppingBag, ShoppingCart, CalendarDays } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function LifestyleLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();

  const tabs = useMemo(() => [
    { name: 'Kitchen', path: '/lifestyle/cookbook', icon: BookOpen },
    { name: 'Fashion', path: '/lifestyle/fashion', icon: ShoppingBag },
    { name: 'Shopping List', path: '/lifestyle/shopping-list', icon: ShoppingCart },
    { name: 'Calendar', path: '/lifestyle/calendar', icon: CalendarDays },
  ], []);

  const currentTab = tabs.find(t => location.pathname.startsWith(t.path)) || tabs[0];

  const getDynamicBackground = () => {
    if (currentTab.name === 'Kitchen') {
      return 'bg-gradient-to-t from-orange-950 to-black to-50%';
    }
    if (currentTab.name === 'Fashion') {
      return 'bg-gradient-to-t from-sky-950 to-black to-50%';
    }
    return theme.background;
  };

  return (
    <div className={`h-screen overflow-y-auto custom-scrollbar ${getDynamicBackground()} ${theme.text} relative overflow-x-hidden`}>
      {/* Ambient background matching initial theme */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden transition-colors duration-1000">
        <div className={`absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full blur-3xl transition-colors duration-1000 ${currentTab.name === 'Kitchen' ? 'bg-orange-500/10' :
          currentTab.name === 'Fashion' ? 'bg-sky-500/10' :
            'bg-purple-500/10'
          }`} />
        <div className={`absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full blur-3xl transition-colors duration-1000 ${currentTab.name === 'Kitchen' ? 'bg-red-500/5' :
          currentTab.name === 'Fashion' ? 'bg-blue-500/5' :
            'bg-fuchsia-500/5'
          }`} />
      </div>

      <div className="relative z-10 w-full min-h-screen flex flex-col">
        {/* Floating Top Navigation */}
        <div className="fixed top-6 left-0 right-0 z-50 px-4 flex justify-between items-center pointer-events-none">
          {/* Back button */}
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate('/')}
            className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white/100 hover:bg-white/10 transition-all group shadow-lg"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </motion.button>

          {/* Pill navigation */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto flex items-center p-1.5 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl"
          >
            {tabs.map(tab => {
              const isActive = currentTab.path === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 ${isActive ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="lifestyle-active-pill"
                      className="absolute inset-0 bg-white/15 rounded-full"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <tab.icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tab.name}</span>
                  </span>
                </button>
              );
            })}
          </motion.div>

          <div className="w-10 h-10" /> {/* Spacer to balance flex-between */}
        </div>

        {/* Content Outlet */}
        <div className="flex-1 w-full pt-28 pb-16">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
