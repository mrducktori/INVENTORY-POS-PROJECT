import React from 'react';

/**
 * React Error Boundary to catch runtime errors in child components
 * and prevent the dreaded "white screen of death" (WSOD).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught a runtime error:', error, errorInfo);

    // If caused by a new build / stale chunk deployment, attempt auto-refresh once
    const msg = error?.message || '';
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('disallowed MIME type')
    ) {
      const now = Date.now();
      const lastReload = Number(sessionStorage.getItem('last_chunk_reload') || 0);
      if (now - lastReload > 30000) {
        sessionStorage.setItem('last_chunk_reload', String(now));
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetError: this.handleReset,
        });
      }

      const isSubmodule = this.props.level === 'tab';

      return (
        <div
          className={`flex items-center justify-center ${
            isSubmodule ? 'w-full py-16 px-4' : 'min-h-screen w-full bg-zinc-50 p-6'
          }`}
        >
          <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5 text-center">
            {/* Warning Icon (SVG, no emoji per Rule 16) */}
            <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto text-zinc-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div className="space-y-1.5">
              <h2 className="m-0 text-lg sm:text-xl font-bold text-zinc-900">
                {this.props.title || (isSubmodule ? 'Unable to display this view' : 'Something went wrong')}
              </h2>
              <p className="m-0 text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
                {this.props.description ||
                  'An unexpected runtime issue occurred while loading this section. You can try refreshing or returning to the previous view.'}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer border border-zinc-200"
              >
                Reload Page
              </button>
            </div>

            {/* Collapsible Error Details for troubleshooting */}
            {this.state.error && (
              <details className="text-left pt-3 border-t border-zinc-100 group">
                <summary className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 cursor-pointer list-none flex items-center justify-between">
                  <span>View error details</span>
                  <span className="text-xs text-zinc-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-2.5 p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-left overflow-x-auto text-[11px] font-mono text-zinc-800 space-y-1">
                  <div className="font-bold text-red-600">{String(this.state.error?.message || this.state.error)}</div>
                  {this.state.error?.stack && (
                    <pre className="m-0 text-zinc-500 text-[10px] whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
