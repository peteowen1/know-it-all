import React, { useState } from 'react';
import { Upload, Download, Check, AlertCircle } from 'lucide-react';
import { exportProgress, importProgress, mergeProgress } from '../lib/transfer';
import { Button, Card } from './ui';

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
      // still works, so tell the user rather than appearing to do nothing.
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
    <Card className="transfer">
      <h3>Move progress between devices</h3>
      <p className="transfer-intro">
        Signed in with Google, your devices sync on their own and you do not need this. Without
        signing in, copy this code on one device and paste it on the other to combine them.
        Importing merges and never overwrites, but it adds the two together, so do not use it
        between two devices signed in to the same account: that would count the same games twice.
      </p>

      <div className="transfer-grid">
        <div className="transfer-block">
          <label className="setup-group-label" htmlFor="transfer-mine">
            <Download size={14} aria-hidden="true" /> This device's code
          </label>
          <textarea id="transfer-mine" className="transfer-box" readOnly value={myCode} rows={3} onFocus={(e) => e.target.select()} />
          <Button variant="secondary" onClick={copy}>
            {copied ? <><Check size={16} aria-hidden="true" /> Copied</> : 'Copy code'}
          </Button>
        </div>

        <div className="transfer-block">
          <label className="setup-group-label" htmlFor="transfer-paste">
            <Upload size={14} aria-hidden="true" /> Paste a code from another device
          </label>
          <textarea
            id="transfer-paste"
            className="transfer-box"
            value={code}
            rows={3}
            spellCheck={false}
            placeholder="Paste the code here"
            onChange={(e) => setCode(e.target.value)}
          />
          <Button variant="primary" onClick={doImport} disabled={!code.trim()}>
            Merge it in
          </Button>
        </div>
      </div>

      {status && (
        <p className={`transfer-status ${status.ok ? 'ok' : 'bad'}`} role="status">
          {status.ok ? <Check size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />} {status.message}
        </p>
      )}
    </Card>
  );
}
