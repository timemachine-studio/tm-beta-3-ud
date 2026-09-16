import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PanelLeftOpen } from 'lucide-react';
import { AppAtmosphere } from './AppAtmosphere';
import { ChatSidebar } from '../chat/ChatSidebar';
import { useRail } from '../../hooks/useRail';
import { useTheme } from '../../context/ThemeContext';
import { useSettingsModal } from '../../context/settingsModalContext';
import { chatService } from '../../services/chat/chatService';

/* The frame every product page outside the chat shares: the rail on the
   left, a top bar with a way back, the page's name and its actions, the
   page scrolling beneath. Picking a chat or "New chat" in the rail hands
   off to the chat route through router state, the same way History always
   has. In the legacy shell (Settings → Interface) there is no rail; the
   back arrow is the way home. */

interface AppShellProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  /** The reading measure. `wide` for lists and tables, `narrow` for forms. */
  measure?: 'narrow' | 'regular' | 'wide';
  /** Where the back arrow goes. The chat, unless the page says otherwise. */
  backTo?: string;
  children: React.ReactNode;
}

const MEASURE: Record<NonNullable<AppShellProps['measure']>, string> = {
  narrow: 'max-w-lg',
  regular: 'max-w-2xl',
  wide: 'max-w-5xl',
};

export function AppShell({ title, actions, measure = 'regular', backTo = '/', children }: AppShellProps) {
  const navigate = useNavigate();
  const { uiStyle } = useTheme();
  const legacyUi = uiStyle === 'legacy';
  const rail = useRail();
  const railOpen = rail.railOpen && !legacyUi;
  const railInline = rail.railInline && !legacyUi;
  const { openSettings } = useSettingsModal();
  const [archiveVersion] = useState(0);

  const openSession = useCallback(async (id: string) => {
    const session = (await chatService.getSessions()).find((s) => s.id === id);
    if (session) navigate('/', { state: { sessionToLoad: session } });
  }, [navigate]);

  return (
    <div
      className="tm-chat-shell relative min-h-screen overflow-hidden"
      style={{ minHeight: 'var(--tm-100vh)', '--tm-rail': railInline ? '272px' : '0px' } as React.CSSProperties}
    >
      <AppAtmosphere />
      <div className="relative flex" style={{ height: 'var(--tm-100vh)' }}>
        {!legacyUi && (
          <ChatSidebar
            open={railOpen}
            overlay={!rail.railWide}
            onClose={() => rail.openRail(false)}
            currentSessionId={null}
            archiveVersion={archiveVersion}
            onNewChat={() => navigate('/', { state: { newChat: true } })}
            onOpenSession={(id) => { void openSession(id); }}
            onOpenAuth={() => navigate('/', { state: { openAuth: true } })}
            onOpenAccount={() => navigate('/account')}
            onOpenSettings={openSettings}
            hue="168 85 247"
          />
        )}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="tm-shell-topbar flex shrink-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <button type="button" onClick={() => navigate(backTo)} aria-label="Back" title="Back" className="tm-notes-icon">
                <ArrowLeft className="h-4 w-4" />
              </button>
              {!railInline && !legacyUi && (
                <button type="button" onClick={() => rail.openRail(true)} aria-label="Show sidebar" className="tm-notes-icon">
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
              <h1 className="tm-shell-title truncate">{title}</h1>
            </div>
            {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
          </header>
          <div className="tm-notes-scroll min-h-0 flex-1 overflow-y-auto">
            <div className={`mx-auto w-full px-4 pb-24 pt-5 sm:px-8 sm:pt-6 ${MEASURE[measure]}`}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
