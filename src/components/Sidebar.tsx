import { type RefObject } from 'react';
import { Bell, LogOut, Search, ShieldCheck, X, Loader2 } from 'lucide-react';
import { formatListTime } from '../lib/format';
import type { Chat, Profile } from '../lib/types';
import { Avatar } from './Avatar';
import { NotificationPrompt } from './NotificationPrompt';
import styles from './ChatShell.module.css';

interface SidebarProps {
  me: Profile;
  chats: Chat[];
  activeId: string | null;
  term: string;
  results: Profile[];
  searching: boolean;
  error: string | null;
  searchInputRef: RefObject<HTMLInputElement | null>;
  /** True in the stacked layout, where the list slides over the conversation. */
  floating: boolean;
  open: boolean;
  onTermChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
  onStartChat: (profile: Profile) => void;
  onClose: () => void;
  onSignOut: () => void;
  isAdmin: boolean;
  onOpenAdmin: () => void;
}

export function Sidebar({
  me,
  chats,
  activeId,
  term,
  results,
  searching,
  error,
  searchInputRef,
  floating,
  open,
  onTermChange,
  onSelectChat,
  onStartChat,
  onClose,
  onSignOut,
  isAdmin,
  onOpenAdmin,
}: SidebarProps) {
  const searchMode = term.trim().length > 0;

  return (
    <aside
      className={styles.sidebar}
      data-floating={floating}
      data-open={open}
      aria-hidden={!open}
      // Keeps a hidden drawer out of the tab order for hardware keyboards.
      {...(!open ? { inert: '' as unknown as boolean } : {})}
    >
      <header className={styles.sidebarHead}>
        <h1 className={styles.brand}>Schoology</h1>
        {floating && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            aria-label="Close conversation list"
          >
            <X size={20} />
          </button>
        )}
      </header>

      <div className={styles.searchRow}>
        <Search size={18} className={styles.searchIcon} aria-hidden="true" />
        <input
          ref={searchInputRef}
          className={styles.search}
          value={term}
          onChange={(event) => onTermChange(event.target.value)}
          placeholder="Search people"
          type="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label="Search people by username"
        />
        {searchMode && (
          <button
            type="button"
            className={styles.clearSearch}
            onClick={() => onTermChange('')}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {error && (
        <p className={styles.sidebarError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.sidebarBody} data-scrollable="">
        {searchMode ? (
          <>
            <p className={styles.sectionLabel}>
              {searching ? 'Searching…' : `People matching “${term.trim()}”`}
            </p>
            {searching && (
              <div className={styles.inlineLoading}>
                <Loader2 size={16} className={styles.spin} />
              </div>
            )}
            {!searching && results.length === 0 && (
              <p className={styles.empty}>
                No one with that username yet. Usernames are exact — check the
                spelling with your friend.
              </p>
            )}
            {results.map((profile) => (
              <button
                key={profile.uid}
                type="button"
                className={styles.row}
                onClick={() => onStartChat(profile)}
              >
                <Avatar name={profile.username} hue={profile.hue} />
                <span className={styles.rowBody}>
                  <span className={styles.rowTop}>
                    <span className={styles.rowName}>{profile.username}</span>
                  </span>
                  <span className={styles.rowPreview}>Tap to start chatting</span>
                </span>
              </button>
            ))}
          </>
        ) : (
          <>
            <p className={styles.sectionLabel}>Conversations</p>
            {chats.length === 0 && (
              <p className={styles.empty}>
                Nothing here yet. Search for a friend's username above to start
                your first conversation.
              </p>
            )}
            {chats.map((chat) => {
              const otherId = chat.members.find((uid) => uid !== me.uid) ?? '';
              const name = chat.memberNames?.[otherId] ?? 'Unknown';
              const unread = chat.unread?.[me.uid] ?? 0;
              const mine = chat.lastSenderId === me.uid;

              return (
                <button
                  key={chat.id}
                  type="button"
                  className={styles.row}
                  data-active={chat.id === activeId}
                  onClick={() => onSelectChat(chat.id)}
                  aria-current={chat.id === activeId ? 'true' : undefined}
                >
                  <Avatar name={name} hue={chat.memberHues?.[otherId] ?? 250} />
                  <span className={styles.rowBody}>
                    <span className={styles.rowTop}>
                      <span className={styles.rowName}>{name}</span>
                      <span className={styles.rowTime}>
                        {formatListTime(chat.lastMessageAt)}
                      </span>
                    </span>
                    <span className={styles.rowBottom}>
                      <span className={styles.rowPreview}>
                        {chat.lastMessage
                          ? `${mine ? 'You: ' : ''}${chat.lastMessage}`
                          : 'No messages yet'}
                      </span>
                      {unread > 0 && (
                        <span className={styles.badge} aria-label={`${unread} unread`}>
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {isAdmin && (
        <button type="button" className={styles.adminRow} onClick={onOpenAdmin}>
          <ShieldCheck size={17} />
          <span>Admin dashboard</span>
        </button>
      )}

      <NotificationPrompt
        render={(state, request) =>
          state === 'default' ? (
            <button type="button" className={styles.notifyRow} onClick={request}>
              <Bell size={17} />
              <span>Turn on notifications</span>
            </button>
          ) : null
        }
      />

      <footer className={styles.sidebarFoot}>
        <div className={styles.meRow}>
          <Avatar name={me.username} hue={me.hue} size="sm" online />
          <span className={styles.meName} title={me.username}>
            {me.username}
          </span>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={19} />
        </button>
      </footer>
    </aside>
  );
}
