import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Cloud, CloudOff, RefreshCw, LogOut } from 'lucide-react';
import { GOOGLE_CLIENT_ID } from '../lib/syncConfig';
import { subscribe, getStatus, getEmail, signInWithGoogle, signOut } from '../lib/sync';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

// Google's script is only needed while signed out, so it is loaded on demand
// rather than in index.html; signed-in visits never fetch it.
let gisPromise = null;
function loadGis() {
  gisPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => {
      gisPromise = null;
      reject(new Error('Google sign-in could not load.'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

const LABELS = {
  idle: { icon: Cloud, text: 'Synced' },
  syncing: { icon: RefreshCw, text: 'Syncing' },
  offline: { icon: CloudOff, text: 'Offline' }
};

export default function AccountButton() {
  const status = useSyncExternalStore(subscribe, getStatus);
  const buttonRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status !== 'signed-out' || !GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then((google) => {
        if (cancelled || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => {
            setError(null);
            signInWithGoogle(credential).catch((err) => setError(err.message));
          }
        });
        google.accounts.id.renderButton(buttonRef.current, {
          theme: 'filled_black', size: 'medium', shape: 'pill', text: 'signin'
        });
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === 'signed-out') {
    // No client ID yet (before Google setup): show nothing rather than a dead button.
    if (!GOOGLE_CLIENT_ID) return null;
    return (
      <div className="account-signin" title={error || 'Sign in to sync progress across your devices'}>
        <div ref={buttonRef} />
        {error && <span className="account-error">{error}</span>}
      </div>
    );
  }

  const { icon: Icon, text } = LABELS[status] || LABELS.idle;
  return (
    <div className="stat-badge account-badge" title={`Signed in as ${getEmail()}`}>
      <Icon size={16} className={status === 'syncing' ? 'spin' : undefined} />
      <span>{text}</span>
      <button
        className="account-signout"
        title="Sign out (progress stays on this device)"
        onClick={() => signOut()}
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
