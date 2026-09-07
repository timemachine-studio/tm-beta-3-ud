import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const SUGGESTIONS = [
  { to: '/', label: 'Chat' },
  { to: '/notes', label: 'Notes' },
  { to: '/healthcare', label: 'Healthcare' },
  { to: '/history', label: 'History' },
  { to: '/help', label: 'Help' },
];

/**
 * Catch-all for unknown URLs.
 *
 * vercel.json rewrites everything to index.html, so before this any typo'd or
 * stale link rendered a completely blank black page — and search engines saw a
 * 200 with no content (production-check.md 1.4).
 */
export function NotFoundPage() {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen ${theme.background} ${theme.text} flex items-center justify-center px-6`}>
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium tracking-[0.2em] text-white/30">404</p>
        <h1 className="mt-4 text-2xl font-medium">This page doesn&apos;t exist</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/50">
          The link may be out of date, or the address might have a typo in it.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {SUGGESTIONS.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.1] hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
