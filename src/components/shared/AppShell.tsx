import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppAtmosphere } from './AppAtmosphere';

/* The frame every product page outside the chat shares: a top bar with a
   way back, the page's name and its actions, the page scrolling beneath.
   The back arrow is the way home in both shells. */

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

  return (
    <div
      className="tm-chat-shell relative min-h-screen overflow-hidden"
      style={{ minHeight: 'var(--tm-100vh)' }}
    >
      <AppAtmosphere />
      <div className="relative flex" style={{ height: 'var(--tm-100vh)' }}>
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="tm-shell-topbar flex shrink-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <button type="button" onClick={() => navigate(backTo)} aria-label="Back" title="Back" className="tm-notes-icon">
                <ArrowLeft className="h-4 w-4" />
              </button>
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
