import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Clock, ArrowDown } from 'lucide-react';
import { formatClock, formatDayLabel, toMillis } from '../lib/format';
import type { Chat, Message, Profile } from '../lib/types';
import styles from './ChatShell.module.css';

interface MessageListProps {
  me: Profile;
  chat: Chat;
  partnerId: string | null;
  messages: Message[];
  onViewImage: (src: string) => void;
}

/** Consecutive messages from one person within this window share a bubble group. */
const GROUP_WINDOW_MS = 4 * 60 * 1000;

export function MessageList({ me, chat, partnerId, messages, onViewImage }: MessageListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  const partnerRead = partnerId ? chat.lastRead?.[partnerId] ?? 0 : 0;

  // Only follow new messages when the reader is already at the bottom —
  // yanking someone out of scrollback to read older messages is infuriating.
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distance < 120);
  };

  useLayoutEffect(() => {
    if (!pinned) return;
    bottomRef.current?.scrollIntoView({ block: 'end' });
    // Intentionally keyed on length only: re-running on every metadata change
    // would fight the user's own scrolling.
  }, [messages.length, pinned]);

  // The composer growing (or the iPad keyboard opening) must not leave the
  // newest message hidden behind it.
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (pinned) bottomRef.current?.scrollIntoView({ block: 'end' });
    });
    observer.observe(root, { attributeFilter: ['data-keyboard', 'style'] });
    return () => observer.disconnect();
  }, [pinned]);

  return (
    <div className={styles.messageArea}>
      <div
        className={styles.messages}
        data-scrollable=""
        ref={scrollerRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {/* Pushes a short conversation down so it sits on the composer rather
            than floating at the top of an empty pane. Collapses to nothing as
            soon as the thread overflows, which keeps the scroller reachable —
            unlike justify-content: flex-end, which strands the top of an
            overflowing list in Safari. */}
        <div className={styles.messagesSpacer} aria-hidden="true" />

        {messages.length === 0 && (
          <p className={styles.threadEmpty}>
            No messages yet — say hello.
          </p>
        )}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const mine = message.senderId === me.uid;
          const at = toMillis(message.createdAt) || (message.pending ? Date.now() : 0);
          const previousAt = previous ? toMillis(previous.createdAt) : 0;

          const newDay =
            !previous || formatDayLabel(previousAt) !== formatDayLabel(at);
          const startsGroup =
            newDay ||
            !previous ||
            previous.senderId !== message.senderId ||
            at - previousAt > GROUP_WINDOW_MS;

          const delivered = !message.pending;
          const read = delivered && at > 0 && partnerRead >= at;

          return (
            <div key={message.id}>
              {newDay && at > 0 && (
                <div className={styles.dayDivider}>
                  <span>{formatDayLabel(at)}</span>
                </div>
              )}

              <div
                className={styles.bubbleRow}
                data-mine={mine}
                data-group-start={startsGroup}
              >
                <div className={styles.bubble} data-mine={mine}>
                  {message.image && (
                    <button
                      type="button"
                      className={styles.photoButton}
                      onClick={() => onViewImage(message.image as string)}
                      aria-label="View photo full size"
                    >
                      <img
                        className={styles.photo}
                        src={message.image}
                        alt="Shared photo"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  )}

                  {message.text && <p className={styles.bubbleText}>{message.text}</p>}

                  <span className={styles.meta}>
                    <span className={styles.metaTime}>{formatClock(at)}</span>
                    {mine && (
                      <span className={styles.metaTick} aria-label={
                        message.pending ? 'Sending' : read ? 'Read' : 'Sent'
                      }>
                        {message.pending ? (
                          <Clock size={13} />
                        ) : read ? (
                          <CheckCheck size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {!pinned && (
        <button
          type="button"
          className={styles.jumpButton}
          onClick={() => {
            setPinned(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }}
          aria-label="Jump to newest message"
        >
          <ArrowDown size={18} />
        </button>
      )}
    </div>
  );
}
