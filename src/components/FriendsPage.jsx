import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { subscribe, getEmail } from '../lib/sync';
import { Button, TextInput } from './ui';
import {
  createGroup, getInvites, getProfile, inviteLink, joinInvite, leaveInvite, newFriendCode, previewInvite,
  readCode, removeFriend, saveProfile, showCode
} from '../lib/boards';

/**
 * Friends and leaderboards: your nickname, whether you appear on public
 * boards, your friend link and code, joining someone else's, your friends and
 * your groups. Opened from the account menu, a results board, or an invite
 * link (/friends?invite=CODE), which shows what you would join and waits for
 * a tap: opening a link never joins anything by itself.
 */
export default function FriendsPage() {
  const [profile, setProfile] = useState(null);
  const [invites, setInvites] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [nickname, setNickname] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [groupName, setGroupName] = useState('');
  // Follows sign-in: signing in while this page is open loads it.
  const email = useSyncExternalStore(subscribe, getEmail);

  const load = useCallback(async () => {
    try {
      const [p, inv] = await Promise.all([getProfile(), getInvites()]);
      setProfile(p);
      setNickname(p.nickname);
      setInvites(inv);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const lookUp = useCallback(async (raw) => {
    const code = readCode(raw);
    if (code.length !== 8) return setNote('A code is 8 letters and numbers, like ABCD-2345.');
    try {
      setPreview(await previewInvite(code));
      setNote(null);
    } catch (err) {
      setPreview(null);
      setNote(err.status === 404 ? 'No invite with that code.' : err.message);
    }
  }, []);

  useEffect(() => {
    if (!email) return;
    load();
    // An invite link: show it, then wait for a tap to join. The code leaves
    // the address so a reload or a shared screenshot does not carry it.
    const code = new URLSearchParams(window.location.search).get('invite');
    if (code) {
      lookUp(code);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [email, load, lookUp]);

  if (!email) {
    return (
      <div className="quiz-screen friends">
        <div className="screen-head">
          <h2>Friends and leaderboards</h2>
          <p>Sign in with Google (top right) to add friends, join groups and see how your times compare. If you opened a friend&apos;s link, open it again after signing in.</p>
        </div>
      </div>
    );
  }

  const act = async (fn, done) => {
    try {
      await fn();
      if (done) setNote(done);
      await load();
    } catch (err) {
      setNote(err.message);
    }
  };

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote(`${what} copied.`);
    } catch {
      setNote(text);
    }
  };

  const share = async (code) => {
    const url = inviteLink(code);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Know-It-All', text: 'Add me on Know-It-All and compare times:', url });
        return;
      } catch {
        // Cancelled, or not allowed here: fall back to copying.
      }
    }
    copy(url, 'Link');
  };

  return (
    <div className="quiz-screen quiz-screen--wide friends">
      <div className="screen-head">
        <h2>Friends and leaderboards</h2>
        <p>Friends and groups see your nickname and your best scores and times. Your email is never shown.</p>
      </div>
      {error && <p className="board-note" role="alert">{error}</p>}
      {note && <p className="board-note" role="status">{note}</p>}

      {preview && (
        <div className="friends-preview">
          <p>
            {preview.yours
              ? 'That is your own invite.'
              : preview.joined
                ? `You are already in ${preview.kind === 'group' ? `the group ${preview.name}` : `friends with ${preview.name}`}.`
                : preview.kind === 'group'
                  ? `Join the group ${preview.name}?`
                  : `Add ${preview.name} as a friend? You will see each other's boards.`}
          </p>
          {!preview.yours && !preview.joined && (
            <div className="setup-actions">
              <Button variant="primary" onClick={() => act(() => joinInvite(preview.code), 'Joined.').then(() => setPreview(null))}>
                {preview.kind === 'group' ? 'Join group' : 'Add friend'}
              </Button>
              <Button variant="tertiary" onClick={() => setPreview(null)}>Not now</Button>
            </div>
          )}
        </div>
      )}

      {profile && (
        <>
          <h3 className="setup-group-label">Your nickname</h3>
          <form className="friends-row" onSubmit={(e) => { e.preventDefault(); act(() => saveProfile({ nickname }), 'Nickname saved.'); }}>
            <TextInput label="Nickname" value={nickname} maxLength={24} onChange={(e) => setNickname(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={!nickname.trim() || nickname.trim() === profile.nickname}>Save</Button>
          </form>

          <h3 className="setup-group-label">Public boards</h3>
          <label className="friends-check">
            <input type="checkbox" checked={profile.public} onChange={(e) => act(() => saveProfile({ public: e.target.checked }), e.target.checked ? `You now appear on public boards as ${profile.nickname}.` : 'You are off the public boards.')} />
            Show me on boards everyone can see, as <strong>{profile.nickname}</strong>. Public boards rank by time that never stops, even if you switch away.
          </label>

          <h3 className="setup-group-label">Add a friend</h3>
          <p className="setup-caption">Send your link, or read out your code. Anyone with it can add you, so share it with people you know. A new code stops the old one working; friends you have stay.</p>
          <p className="friends-code">{showCode(profile.friendCode)}</p>
          <div className="setup-actions">
            <Button variant="primary" onClick={() => share(profile.friendCode)}>Share my link</Button>
            <Button variant="secondary" onClick={() => copy(showCode(profile.friendCode), 'Code')}>Copy code</Button>
            <Button variant="tertiary" onClick={() => act(newFriendCode, 'New code made. The old one no longer works.')}>New code</Button>
          </div>
          <form className="friends-row" onSubmit={(e) => { e.preventDefault(); lookUp(codeInput); }}>
            <TextInput label="A friend's or group's code" placeholder="ABCD-2345" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={!codeInput.trim()}>Look up</Button>
          </form>
        </>
      )}

      {invites && (
        <>
          <h3 className="setup-group-label">Friends ({invites.friends.length})</h3>
          {invites.friends.length ? (
            <ul className="friends-list">
              {invites.friends.map((f) => (
                <li key={f.code}>
                  <span>{f.nickname}</span>
                  <Button variant="tertiary" onClick={() => act(() => removeFriend(f.code), `Removed ${f.nickname}. They cannot add you again with your code.`)}>Remove</Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="setup-caption">None yet.</p>
          )}

          <h3 className="setup-group-label">Groups</h3>
          {invites.groups.length > 0 && (
            <ul className="friends-list">
              {invites.groups.map((g) => (
                <li key={g.code}>
                  <span>{g.name} <em>· {g.people} {g.people === 1 ? 'person' : 'people'}</em></span>
                  <Button variant="tertiary" onClick={() => share(g.code)}>Share</Button>
                  <Button variant="tertiary" onClick={() => act(() => leaveInvite(g.code), g.owned ? `Deleted ${g.name}.` : `Left ${g.name}.`)}>{g.owned ? 'Delete' : 'Leave'}</Button>
                </li>
              ))}
            </ul>
          )}
          <form className="friends-row" onSubmit={(e) => { e.preventDefault(); act(() => createGroup(groupName), `Made ${groupName.trim()}. Share its link to invite people.`).then(() => setGroupName('')); }}>
            <TextInput label="New group" placeholder="Pub quiz team" maxLength={40} value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={!groupName.trim()}>Make group</Button>
          </form>
        </>
      )}
    </div>
  );
}
