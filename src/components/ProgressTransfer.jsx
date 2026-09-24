import React, { useState } from 'react';
import { Upload, Download, Check, AlertCircle } from 'lucide-react';
import { exportProgress, importProgress, mergeProgress } from '../lib/transfer';

/**
 * Move progress between devices.
 *
 * For devices that are not signed in (signed-in devices sync on their own,
 * src/lib/sync.js). This is the manual bridge: a code you copy from one and
 * paste into the other. Import merges rather than overwrites, because the user
 * cannot tell in advance which device holds more progress and there is no undo.
 */
export default function ProgressTransfer({ profile, onImport }) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(null);

  const myCode = exportProgress(profile);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access is refused in some browsers without a user gesture, or
      // over plain http. The textarea below is selectable, so the manual path
      // still works — tell the user rather than appearing to do nothing.
      setStatus({ ok: false, message: 'Could not reach the clipboard. Select the code and copy it manually.' });
    }
  };

  const doImport = () => {
    const result = importProgress(code);
    if (!result.ok) {
      setStatus({ ok: false, message: result.error });
      return;
    }
    let merged;
    try {
      merged = mergeProgress(profile, result.data);
    } catch (err) {
      // React error boundaries do not catch throws from event handlers, so
      // without this the button would appear to do nothing at all: no error, no
      // success, no clue whether the paste was even received.
      console.error('Progress merge failed on malformed data:', err);
      setStatus({
        ok: false,
        message: 'That code contains data this app could not read. Nothing was changed.'
      });
      return;
    }
    onImport(merged);
    setStatus({
      ok: true,
      message: `Merged. ${merged.vault.length} questions tracked, ${merged.stats.totalAnswered} answered in total.`
    });
    setCode('');
  };

  return (
    <div className="category-heatmap-card">
      <h3>Move progress between devices</h3>
      <p className="empty-sub">
        Signed in with Google, your devices sync on their own and you do not need this. Without
        signing in, copy this code on one device and paste it on the other to combine them.
        Importing merges and never overwrites, but it adds the two together, so do not use it
        between two devices signed in to the same account: that would count the same games twice.
      </p>

      <div className="transfer-grid">
        <div className="transfer-block">
          <span className="setup-group-label">
            <Download size={14} /> This device's code
          </span>
          <textarea className="transfer-box" readOnly value={myCode} rows={3} onFocus={(e) => e.target.select()} />
          <button className="btn btn-ghost" onClick={copy}>
            {copied ? <><Check size={16} /> Copied</> : 'Copy code'}
          </button>
        </div>

        <div className="transfer-block">
          <span className="setup-group-label">
            <Upload size={14} /> Paste a code from another device
          </span>
          <textarea
            className="transfer-box"
            value={code}
            rows={3}
            spellCheck={false}
            placeholder="Paste the code here"
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn btn-primary" onClick={doImport} disabled={!code.trim()}>
            Merge it in
          </button>
        </div>
      </div>

      {status && (
        <p className={`transfer-status ${status.ok ? 'ok' : 'bad'}`}>
          {status.ok ? <Check size={14} /> : <AlertCircle size={14} />} {status.message}
        </p>
      )}
    </div>
  );
}
