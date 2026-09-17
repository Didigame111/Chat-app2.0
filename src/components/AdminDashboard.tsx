import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import {
  hasAdminRights,
  isDefaultAdmin,
  purgeUser,
  setUserBlocked,
  subscribeToAllUsers,
} from '../lib/admin';
import { isOnline } from '../lib/chat';
import { formatListTime, toMillis } from '../lib/format';
import type { Profile } from '../lib/types';
import { Avatar } from './Avatar';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './AdminDashboard.module.css';

interface AdminDashboardProps {
  me: Profile;
  adminUids: string[];
  onClose: () => void;
}

type Pending = { kind: 'block' | 'unblock' | 'purge'; user: Profile } | null;

export function AdminDashboard({ me, adminUids, onClose }: AdminDashboardProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeToAllUsers((next) => {
        setUsers(next);
        setLoading(false);
      }),
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => user.usernameLower.includes(needle));
  }, [users, term]);

  const stats = useMemo(
    () => ({
      total: users.length,
      online: users.filter((user) => isOnline(user.lastSeen)).length,
      blocked: users.filter((user) => user.blocked).length,
    }),
    [users],
  );

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'purge') {
        const { conversationsDeleted } = await purgeUser(pending.user.uid);
        setFlash(
          `Removed ${pending.user.username} and ${conversationsDeleted} conversation${
            conversationsDeleted === 1 ? '' : 's'
          }. Their sign-in record still needs deleting in the Firebase console.`,
        );
      } else {
        await setUserBlocked(pending.user.uid, pending.kind === 'block');
        setFlash(
          pending.kind === 'block'
            ? `${pending.user.username} is blocked and has been signed out.`
            : `${pending.user.username} can sign in again.`,
        );
      }
      setPending(null);
    } catch (err) {
      console.error('admin action failed', err);
      setError(
        'That did not go through. Check that your uid is listed in config/admins and that the rules are deployed.',
      );
    } finally {
      setBusy(false);
    }
  };

  const dialogCopy = () => {
    if (!pending) return null;
    if (pending.kind === 'purge') {
      return {
        title: `Delete ${pending.user.username}?`,
        body:
          'This erases their profile and every conversation they were part of, including the other person’s copy of those messages. It cannot be undone. Their Firebase sign-in record is left behind and has to be deleted from the Firebase console — removing it from here would need a paid plan.',
        confirmLabel: 'Delete account data',
        destructive: true,
      };
    }
    if (pending.kind === 'block') {
      return {
        title: `Block ${pending.user.username}?`,
        body:
          'They are signed out immediately, everywhere, and cannot sign back in. Their messages are kept. You can undo this at any time.',
        confirmLabel: 'Block account',
        destructive: true,
      };
    }
    return {
      title: `Unblock ${pending.user.username}?`,
      body: 'They will be able to sign in again straight away.',
      confirmLabel: 'Unblock account',
      destructive: false,
    };
  };

  const copy = dialogCopy();

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onClose}>
          <ArrowLeft size={20} />
          <span>Back to chat</span>
        </button>
        <div className={styles.headTitle}>
          <ShieldCheck size={20} />
          <h1>Admin</h1>
        </div>
      </header>

      <div className={styles.body} data-scrollable="">
        <div className={styles.stats}>
          <div className={styles.stat}>
            <Users size={18} />
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Accounts</span>
          </div>
          <div className={styles.stat}>
            <CheckCircle2 size={18} />
            <span className={styles.statValue}>{stats.online}</span>
            <span className={styles.statLabel}>Online now</span>
          </div>
          <div className={styles.stat}>
            <Ban size={18} />
            <span className={styles.statValue}>{stats.blocked}</span>
            <span className={styles.statLabel}>Blocked</span>
          </div>
        </div>

        {flash && (
          <p className={styles.flash} role="status">
            {flash}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.searchRow}>
          <Search size={18} className={styles.searchIcon} aria-hidden="true" />
          <input
            className={styles.search}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Filter by username"
            type="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Filter accounts by username"
          />
        </div>

        {loading ? (
          <p className={styles.empty}>Loading accounts…</p>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>No accounts match that.</p>
        ) : (
          <ul className={styles.list}>
            {filtered.map((user) => {
              const isMe = user.uid === me.uid;
              const isAdminUser = hasAdminRights(user, adminUids);

              return (
                <li key={user.uid} className={styles.row} data-blocked={Boolean(user.blocked)}>
                  <Avatar name={user.username} hue={user.hue} online={isOnline(user.lastSeen)} />

                  <div className={styles.rowInfo}>
                    <p className={styles.rowName}>
                      {user.username}
                      {isAdminUser && (
                        <span className={styles.tagAdmin}>
                          {isDefaultAdmin(user) ? 'Owner' : 'Admin'}
                        </span>
                      )}
                      {isMe && <span className={styles.tagYou}>You</span>}
                      {user.blocked && <span className={styles.tagBlocked}>Blocked</span>}
                    </p>
                    <p className={styles.rowMeta}>
                      Joined {formatListTime(toMillis(user.createdAt)) || 'recently'}
                      {' · '}
                      {isOnline(user.lastSeen)
                        ? 'online now'
                        : user.lastSeen
                          ? `last seen ${formatListTime(user.lastSeen)}`
                          : 'never seen'}
                    </p>
                    <p className={styles.rowUid}>{user.uid}</p>
                  </div>

                  <div className={styles.rowActions}>
                    {/* An admin who could remove themselves or another admin
                        could lock everyone out of the dashboard, and the only
                        way back in would be the Firebase console. */}
                    {isMe || isAdminUser ? (
                      <span className={styles.protected}>Protected</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.action}
                          onClick={() =>
                            setPending({ kind: user.blocked ? 'unblock' : 'block', user })
                          }
                        >
                          {user.blocked ? <CheckCircle2 size={17} /> : <Ban size={17} />}
                          <span>{user.blocked ? 'Unblock' : 'Block'}</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.action} ${styles.actionDanger}`}
                          onClick={() => setPending({ kind: 'purge', user })}
                        >
                          <Trash2 size={17} />
                          <span>Delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className={styles.footnote}>
          <strong>About deleting:</strong> this removes a person&rsquo;s profile and
          all of their conversations, and blocks them so the leftover sign-in
          cannot be used. Erasing the Firebase Authentication record itself
          needs the Admin SDK, which needs a server, which needs the paid plan
          — so finish the job in the Firebase console under{' '}
          <strong>Authentication → Users</strong>: find the row, open the ⋮ menu
          and choose <strong>Delete account</strong>. The uid under each name
          above is there to help you match the row.
        </p>
      </div>

      {pending && copy && (
        <ConfirmDialog
          title={copy.title}
          body={copy.body}
          confirmLabel={copy.confirmLabel}
          destructive={copy.destructive}
          busy={busy}
          onConfirm={() => void run()}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
