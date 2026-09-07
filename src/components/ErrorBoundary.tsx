import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * Rendered instead of the default full-screen fallback. Use it for a
   * boundary around part of the UI (e.g. the chat transcript) so a bad message
   * cannot take the shell down with it.
   */
  fallback?: (reset: () => void, error: Error) => React.ReactNode;
  /** Identifies which boundary caught it, in logs. */
  name?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time exceptions.
 *
 * Without one, any thrown render unmounts the entire tree and leaves a black
 * screen with no explanation and no way out (production-check.md 1.3).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // TODO(2.1): forward to the error tracker once one is wired up.
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(this.reset, error);

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-2xl">
            ⏳
          </div>
          <h1 className="text-xl font-medium">Something broke on our end</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            TimeMachine hit an unexpected error and stopped rendering this page.
            Your chats are safe.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-white/15 bg-white/[0.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-white/[0.14]"
            >
              Reload
            </button>
            <a
              href="/"
              className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
