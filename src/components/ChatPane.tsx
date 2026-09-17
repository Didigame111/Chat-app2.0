import { useEffect, useState } from 'react';
import { MessagesSquare, PanelLeft, X } from 'lucide-react';
import { isTyping } from '../lib/chat';
import type { Chat, Message, Profile } from '../lib/types';
import { Avatar } from './Avatar';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import styles from './ChatShell.module.css';

interface ChatPaneProps {
  me: Profile;
  chat: Chat | undefined;
  partnerId: string | null;
  partnerName: string;
  partnerHue: number;
  partnerOnline: boolean;
  messages: Message[];
  loading: boolean;
  showMenuButton: boolean;
  onOpenList: () => void;
  onSend: (text: string, image: string | null) => Promise<void>;
  onTyping: (typing: boolean) => void;
}

export function ChatPane({
  me,
  chat,
  partnerId,
  partnerName,
  partnerHue,
  partnerOnline,
  messages,
  loading,
  showMenuButton,
  onOpenList,
  onSend,
  onTyping,
}: ChatPaneProps) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (!chat) {
    return (
      <section className={styles.pane}>
        <div className={styles.placeholder}>
          <div className={styles.placeholderMark}>
            <MessagesSquare size={30} />
          </div>
          <h2 className={styles.placeholderTitle}>Pick a conversation</h2>
          <p className={styles.placeholderCopy}>
            Choose someone from the list, or search a username to start
            something new.
          </p>
          {showMenuButton && (
            <button type="button" className={styles.placeholderAction} onClick={onOpenList}>
              <PanelLeft size={18} />
              Open conversations
            </button>
          )}
        </div>
      </section>
    );
  }

  const partnerTyping = partnerId ? isTyping(chat, partnerId) : false;

  return (
    <section className={styles.pane}>
      <header className={styles.paneHead}>
        {showMenuButton && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={onOpenList}
            aria-label="Open conversation list"
          >
            <PanelLeft size={21} />
          </button>
        )}

        <Avatar name={partnerName} hue={partnerHue} online={partnerOnline} />

        <div className={styles.paneHeadText}>
          <h2 className={styles.paneTitle}>{partnerName}</h2>
          <p className={styles.paneStatus} data-typing={partnerTyping}>
            {partnerTyping ? (
              <>
                <span className={styles.typingDots} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                typing…
              </>
            ) : partnerOnline ? (
              'Online'
            ) : (
              'Offline'
            )}
          </p>
        </div>
      </header>

      {loading && messages.length === 0 ? (
        <div className={styles.paneLoading}>Loading messages…</div>
      ) : (
        <MessageList
          me={me}
          chat={chat}
          partnerId={partnerId}
          messages={messages}
          onViewImage={setLightbox}
        />
      )}

      <Composer onSend={onSend} onTyping={onTyping} />

      {lightbox && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setLightbox(null)}
            aria-label="Close photo"
          >
            <X size={22} />
          </button>
          <img className={styles.lightboxImage} src={lightbox} alt="Shared photo, full size" />
        </div>
      )}
    </section>
  );
}
