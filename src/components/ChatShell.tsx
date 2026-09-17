import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  deleteConversation,
  hideConversation,
  isHiddenFor,
  isOnline,
  markConversationRead,
  openConversation,
  searchProfiles,
  subscribeToChats,
  subscribeToMessages,
  sendMessage,
  setTyping,
} from '../lib/chat';
import { hasAdminRights, subscribeToAdmins } from '../lib/admin';
import { AdminDashboard } from './AdminDashboard';
import { ConfirmDialog } from './ConfirmDialog';
import { notify, previewOf } from '../lib/notify';
import type { Chat, Message, Profile } from '../lib/types';
import { useSplitLayout } from '../hooks/useMediaQuery';
import { ChatPane } from './ChatPane';
import { Sidebar } from './Sidebar';
import styles from './ChatShell.module.css';

interface ChatShellProps {
  me: Profile;
  onSignOut: () => void;
}

export function ChatShell({ me, onSignOut }: ChatShellProps) {
  const isSplit = useSplitLayout();

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [adminUids, setAdminUids] = useState<string[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const seenStamps = useRef<Record<string, number>>({});

  useEffect(() => subscribeToAdmins(setAdminUids), []);

  const isAdmin = hasAdminRights(me, adminUids);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeId),
    [chats, activeId],
  );

  /**
   * What the sidebar shows. A conversation you closed stays out of the list
   * until something newer than the moment you closed it arrives — except for
   * the one you are reading right now, which would be jarring to have vanish
   * out from under you.
   */
  const visibleChats = useMemo(
    () => chats.filter((chat) => chat.id === activeId || !isHiddenFor(chat, me.uid)),
    [chats, activeId, me.uid],
  );

  const partnerId = activeChat?.members.find((uid) => uid !== me.uid) ?? null;
  const partnerName = partnerId ? activeChat?.memberNames?.[partnerId] ?? 'Unknown' : '';
  const partnerHue = partnerId ? activeChat?.memberHues?.[partnerId] ?? 250 : 250;

  // ------------------------------------------------------------ conversations

  useEffect(() => subscribeToChats(me.uid, setChats), [me.uid]);

  // ------------------------------------------------------------ notifications
  // The first snapshot seeds the baseline so signing in does not fire a banner
  // for every conversation you already had.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current) {
      chats.forEach((chat) => {
        seenStamps.current[chat.id] = chat.lastMessageAt;
      });
      seeded.current = chats.length >= 0;
      return;
    }

    chats.forEach((chat) => {
      const previous = seenStamps.current[chat.id] ?? 0;
      seenStamps.current[chat.id] = chat.lastMessageAt;

      const isNew = chat.lastMessageAt > previous;
      const fromSomeoneElse = chat.lastSenderId && chat.lastSenderId !== me.uid;
      const lookingAtIt = chat.id === activeId && document.visibilityState === 'visible';

      if (isNew && fromSomeoneElse && !lookingAtIt) {
        // A closed conversation un-closes itself when something new arrives,
        // so it is right to notify here too.
        const sender = chat.memberNames?.[chat.lastSenderId] ?? 'Someone';
        notify(sender, previewOf(chat.lastMessage, chat.lastMessage === '📷 Photo'), chat.id);
      }
    });
  }, [chats, activeId, me.uid]);

  // Unread badge in the tab / Home Screen title.
  const totalUnread = useMemo(
    () => chats.reduce((sum, chat) => sum + (chat.unread?.[me.uid] ?? 0), 0),
    [chats, me.uid],
  );

  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Schoology 2.0` : 'Schoology 2.0';
  }, [totalUnread]);

  // ------------------------------------------------------------------ messages

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    return subscribeToMessages(activeId, (next) => {
      setMessages(next);
      setMessagesLoading(false);
    });
  }, [activeId]);

  // Clear the unread badge whenever this conversation is actually on screen.
  useEffect(() => {
    if (!activeId || !activeChat) return;
    if (document.visibilityState !== 'visible') return;
    if ((activeChat.unread?.[me.uid] ?? 0) === 0) return;
    void markConversationRead(activeId, me.uid);
  }, [activeId, activeChat, me.uid, messages.length]);

  // ------------------------------------------------------------------ presence

  useEffect(() => {
    if (!partnerId) {
      setPartnerLastSeen(0);
      return;
    }
    return onSnapshot(doc(db(), 'users', partnerId), (snap) => {
      setPartnerLastSeen((snap.data() as Profile | undefined)?.lastSeen ?? 0);
    });
  }, [partnerId]);

  // Presence is time-based, so re-render on a timer to let the dot go grey.
  const [, forcePresenceTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => forcePresenceTick((n) => n + 1), 20_000);
    return () => window.clearInterval(timer);
  }, []);

  // -------------------------------------------------------------------- search

  useEffect(() => {
    if (!term.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        setResults(await searchProfiles(term, me.uid));
      } catch (error) {
        console.error('search failed', error);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [term, me.uid]);

  // --------------------------------------------------------------- interaction

  const selectChat = useCallback(
    (chatId: string) => {
      setActiveId(chatId);
      setDrawerOpen(false);
      void markConversationRead(chatId, me.uid);
    },
    [me.uid],
  );

  const startChatWith = useCallback(
    async (them: Profile) => {
      try {
        const chatId = await openConversation(me, them);
        setTerm('');
        setResults([]);
        selectChat(chatId);
      } catch (error) {
        console.error('could not open conversation', error);
        setStartError('Could not open that conversation. Check your connection.');
      }
    },
    [me, selectChat],
  );

  const handleSend = useCallback(
    async (text: string, image: string | null) => {
      if (!activeId || !partnerId) return;
      await sendMessage({
        chatId: activeId,
        senderId: me.uid,
        recipientId: partnerId,
        text,
        image,
      });
    },
    [activeId, partnerId, me.uid],
  );

  const handleHideConversation = useCallback(() => {
    if (!activeId) return;
    void hideConversation(activeId, me.uid);
    setActiveId(null);
    if (!isSplit) setDrawerOpen(true);
  }, [activeId, me.uid, isSplit]);

  const handleDeleteConversation = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteConversation(confirmDelete);
      setActiveId((current) => (current === confirmDelete ? null : current));
      setConfirmDelete(null);
      if (!isSplit) setDrawerOpen(true);
    } catch (error) {
      console.error('could not delete conversation', error);
      setStartError('Could not delete that conversation. Check your connection.');
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete, isSplit]);

  const handleTyping = useCallback(
    (typing: boolean) => {
      if (!activeId) return;
      void setTyping(activeId, me.uid, typing);
    },
    [activeId, me.uid],
  );

  // Hardware keyboard shortcuts — an iPad on a Magic Keyboard or Smart Folio
  // should feel like a desktop app, not a phone.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setDrawerOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 60);
      }
      if (event.key === 'Escape') {
        if (drawerOpen) setDrawerOpen(false);
        else if (!isSplit && activeId) setActiveId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, isSplit, activeId]);

  // In the stacked layout the conversation list IS the home screen, so open
  // the drawer whenever there is nothing to show in the pane.
  useEffect(() => {
    if (!isSplit && !activeId) setDrawerOpen(true);
    if (isSplit) setDrawerOpen(false);
  }, [isSplit, activeId]);

  const showDrawer = isSplit || drawerOpen;

  if (showAdmin && isAdmin) {
    return (
      <AdminDashboard me={me} adminUids={adminUids} onClose={() => setShowAdmin(false)} />
    );
  }

  return (
    <div className={styles.shell} data-layout={isSplit ? 'split' : 'stacked'}>
      {!isSplit && drawerOpen && (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close conversation list"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <Sidebar
        me={me}
        chats={visibleChats}
        activeId={activeId}
        term={term}
        results={results}
        searching={searching}
        error={startError}
        searchInputRef={searchInputRef}
        floating={!isSplit}
        open={showDrawer}
        onTermChange={setTerm}
        onSelectChat={selectChat}
        onStartChat={startChatWith}
        onClose={() => setDrawerOpen(false)}
        onSignOut={onSignOut}
        isAdmin={isAdmin}
        onOpenAdmin={() => {
          setShowAdmin(true);
          setDrawerOpen(false);
        }}
      />

      <ChatPane
        me={me}
        chat={activeChat}
        partnerName={partnerName}
        partnerHue={partnerHue}
        partnerOnline={isOnline(partnerLastSeen)}
        partnerId={partnerId}
        messages={messages}
        loading={messagesLoading}
        showMenuButton={!isSplit}
        onOpenList={() => setDrawerOpen(true)}
        onSend={handleSend}
        onTyping={handleTyping}
        onHideConversation={handleHideConversation}
        onDeleteConversation={() => setConfirmDelete(activeId)}
      />

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this conversation?"
          body={
            'Every message and photo in it is erased for both of you, not just ' +
            'hidden from your list. This cannot be undone. To simply clear it ' +
            'from your own sidebar, use Close conversation instead.'
          }
          confirmLabel="Delete for everyone"
          destructive
          busy={deleting}
          onConfirm={() => void handleDeleteConversation()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
