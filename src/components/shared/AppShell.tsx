import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PanelLeftOpen } from 'lucide-react';
import { AppAtmosphere } from './AppAtmosphere';
import { ChatSidebar } from '../chat/ChatSidebar';
import { useRail } from '../../hooks/useRail';
import { useSettingsModal } from '../../context/settingsModalContext';
import { chatService } from '../../services/chat/chatService';

/* The frame every product page outside the chat shares: the rail on the
   left, a top bar with the page's name and its actions, the page scrolling
   beneath. Picking a chat or "New chat" in the rail hands off to the chat
   route through router state, the same way History always has. */

interface AppShellProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  /** The reading measure. `wide` for lists and tables, `narrow` for forms. */
  measure?: 'narrow' | 'regular' | 'wide';
  children: React.ReactNode;
}

const MEASURE: Record<NonNullable<AppShellProps['measure']>, string> = {
  narrow: 'max-w-lg',
  regular: 'max-w-2xl',
  wide: 'max-w-5xl',
};

export function AppShell({ title, actions, measure = 'regular', children }: AppShellProps) {
  const navigate = useNavigate();
  const { railOpen, railWide, railInline, openRail } = useRail();
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
        <ChatSidebar
          open={railOpen}
          overlay={!railWide}
          onClose={() => openRail(false)}
          currentSessionId={null}
          archiveVersion={archiveVersion}
          onNewChat={() => navigate('/', { state: { newChat: true } })}
          onOpenSession={(id) => { void openSession(id); }}
          onOpenAuth={() => navigate('/', { state: { openAuth: true } })}
          onOpenAccount={() => navigate('/account')}
          onOpenSettings={openSettings}
          hue="168 85 247"
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="tm-shell-topbar flex shrink-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {!railInline && (
                <button type="button" onClick={() => openRail(true)} aria-label="Show sidebar" className="tm-notes-icon">
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              )}
              <h1 className="tm-shell-title truncate">{title}</h1>
            </div>
            {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
          </header>
          <div className="tm-notes-scroll min-h-0 flex-1 overflow-y-auto">
            <div className={`mx-auto w-full px-5 pb-24 pt-6 sm:px-8 ${MEASURE[measure]}`}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
