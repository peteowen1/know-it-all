import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Cloud, CloudOff, RefreshCw, LogOut, UserRound } from 'lucide-react';
import { GOOGLE_CLIENT_ID } from '../lib/syncConfig';
import { subscribe, getStatus, getEmail, signInWithGoogle, signOut } from '../lib/sync';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

// Google's script is only needed while signed out, and only once the account
// menu opens: loaded with the page it took 100 KB from each game's data on a
// slow phone (Who am I 4.66 s to its first screen, 3.69 s without it;
// 2026-10-24). Signed-in visits never fetch it.
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

/**
 * The account area: one button that opens a small menu with sync status,
 * sign in / sign out, and the Reset action (a danger text button behind a
 * two-step confirm, in the menu rather than a dialog).
 */
export default function AccountButton({ onReset }) {
  const status = useSyncExternalStore(subscribe, getStatus);
  const buttonRef = useRef(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const rendered = useRef(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const signedOut = status === 'signed-out';

  useEffect(() => {
    // The button div unmounts on sign-in, so a later sign-out draws it again.
    if (!signedOut) rendered.current = false;
    if (!signedOut || !open || rendered.current || !GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    setError(null);
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
        // Google's button cannot be restyled, only clipped to our corner radius.
        google.accounts.id.renderButton(buttonRef.current, {
          theme: 'filled_black', size: 'large', shape: 'rectangular', text: 'signin'
        });
        rendered.current = true;
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [signedOut, open]);

  // Close on Escape (focus returns to the button) or a click outside the menu.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setConfirming(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const { icon: StatusIcon, text: statusText } = signedOut ? { icon: UserRound, text: 'Sign in' } : LABELS[status] || LABELS.idle;
  // Signed in, a reset syncs like any other change, so say so.
  const where = getEmail() ? 'on every device signed in to this account' : 'on this device';

  return (
    <div className="account" ref={rootRef}>
      <button
        ref={triggerRef}
        className="account-trigger"
        aria-expanded={open}
        aria-controls="account-panel"
        aria-label={signedOut ? 'Account' : `Account, ${statusText.toLowerCase()}`}
        onClick={() => {
          setOpen((o) => !o);
          setConfirming(false);
        }}
      >
        <StatusIcon size={18} strokeWidth={1.75} className={status === 'syncing' ? 'spin' : undefined} aria-hidden="true" />
        <span className="account-trigger-text">{statusText}</span>
      </button>

      <div className="account-panel" id="account-panel" hidden={!open}>
        {signedOut ? (
          <p className="account-who">
            {GOOGLE_CLIENT_ID
              ? 'Sign in to sync your progress across devices.'
              : 'Your progress is saved on this device.'}
          </p>
        ) : (
          <p className="account-who">
            Signed in as <strong>{getEmail()}</strong>. {statusText}.
          </p>
        )}

        {signedOut && GOOGLE_CLIENT_ID && (
          <div className="account-signin">
            <div className="account-signin-btn" ref={buttonRef} />
            {error && <span className="account-error">{error}</span>}
          </div>
        )}

        {!signedOut && (
          <button
            className="btn btn-secondary"
            aria-label="Sign out"
            title="Sign out (progress stays on this device)"
            onClick={() => {
              signOut();
              setOpen(false);
            }}
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" /> Sign out
          </button>
        )}

        <div className="account-danger">
          {confirming ? (
            <>
              <p>Clear all saved progress {where}? This cannot be undone.</p>
              <div className="account-danger-row">
                <button
                  className="btn btn-danger-text"
                  onClick={() => {
                    setConfirming(false);
                    setOpen(false);
                    onReset();
                  }}
                >
                  Clear progress
                </button>
                <button className="btn btn-tertiary" onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <button className="btn btn-danger-text" onClick={() => setConfirming(true)}>Reset progress</button>
          )}
        </div>
      </div>
    </div>
  );
}
