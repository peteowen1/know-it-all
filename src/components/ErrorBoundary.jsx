import React from 'react';

// Browsers word a failed dynamic import differently: Chrome "Failed to fetch
// dynamically imported module", Safari "Importing a module script failed",
// Firefox "error loading dynamically imported module". Vite's preload helper
// throws "Unable to preload CSS".
const isLoadError = (error) =>
  /dynamically imported module|module script failed|Unable to preload/i.test(String(error?.message || error));

/**
 * Last line of defence. The question bank is validated at build time, so a
 * malformed record should never reach the browser — but "should never" is
 * exactly the assumption that failed in the previous build, where 846 of 999
 * questions shipped with template filler nobody noticed.
 *
 * Without this, one bad record or one corrupted localStorage value renders a
 * blank white page with no indication of what went wrong.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Nothing is sent anywhere — this app has no backend. Logging is so the
    // failure is discoverable in the console rather than being a blank screen.
    console.error('Unrecoverable render error:', error, info?.componentStack);
  }

  handleReset = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sqt_') || k.startsWith('gw_'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // If storage is unreadable there is nothing to clear; reload anyway.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    // Screens and the question bank load on demand, so being offline (or a
    // deploy replacing the files under an open tab) surfaces here. That is not
    // the saved progress's fault, so never offer to clear it.
    if (isLoadError(this.state.error)) {
      return (
        <div className="app-layout">
          <div className="card empty-state">
            <h2>Couldn't load that screen</h2>
            <p>Check your connection and try again. Your progress is safe.</p>
            <div className="actions-bar centered">
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="app-layout">
        <div className="card empty-state">
          <h2>Something broke</h2>
          <p>
            The app hit an error it could not recover from. Your saved progress is the most
            likely cause, and clearing it will almost certainly fix this.
          </p>
          <p className="empty-sub">
            <code>{String(this.state.error?.message || this.state.error)}</code>
          </p>
          <div className="actions-bar centered">
            <button className="btn btn-primary" onClick={this.handleReset}>
              Clear saved progress and reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
