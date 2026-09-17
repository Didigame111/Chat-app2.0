import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { ImagePlus, Loader2, SendHorizontal, X } from 'lucide-react';
import { ACCEPTED_IMAGE_TYPES, compressImage } from '../lib/image';
import styles from './ChatShell.module.css';

interface ComposerProps {
  disabled?: boolean;
  onSend: (text: string, image: string | null) => Promise<void>;
  onTyping: (typing: boolean) => void;
}

/** Tallest the input grows before it starts scrolling internally. */
const MAX_TEXTAREA_PX = 148;

const TYPING_IDLE_MS = 2500;

export function Composer({ disabled, onSend, onTyping }: ComposerProps) {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const typingActive = useRef(false);

  // Auto-grow. Reset to auto first or the box can only ever get taller.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [text]);

  useEffect(() => {
    return () => {
      window.clearTimeout(typingTimer.current);
      if (typingActive.current) onTyping(false);
    };
  }, [onTyping]);

  const pingTyping = () => {
    if (!typingActive.current) {
      typingActive.current = true;
      onTyping(true);
    }
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      typingActive.current = false;
      onTyping(false);
    }, TYPING_IDLE_MS);
  };

  /**
   * `notify: false` clears the local state without spending a write. Sending a
   * message already zeroes the typing flag inside the same batch, so telling
   * the server again would cost an extra write per message for nothing.
   */
  const stopTyping = (notify = true) => {
    window.clearTimeout(typingTimer.current);
    if (typingActive.current) {
      typingActive.current = false;
      if (notify) onTyping(false);
    }
  };

  const pickImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setPreparing(true);
    try {
      const compressed = await compressImage(file);
      setImage(compressed.dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That photo could not be added.');
    } finally {
      setPreparing(false);
    }
  };

  const submit = async () => {
    if (sending || preparing) return;
    if (!text.trim() && !image) return;

    const payloadText = text;
    const payloadImage = image;

    // Clear straight away: the Firestore write is offline-queued, so waiting
    // for the round trip would make the app feel slow on patchy Wi-Fi.
    setText('');
    setImage(null);
    stopTyping(false);
    setSending(true);
    setError(null);

    try {
      await onSend(payloadText, payloadImage);
    } catch (err) {
      console.error('send failed', err);
      setText(payloadText);
      setImage(payloadImage);
      setError('Message not sent. Check your connection and try again.');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;

    // With a Magic Keyboard or Smart Folio attached the software keyboard
    // never opens, so Return should send — that is what a keyboard user
    // expects. With the on-screen keyboard up, Return has to stay a newline,
    // because it is the only way to get one.
    const softKeyboardUp = document.documentElement.dataset.keyboard === 'open';
    if (softKeyboardUp) return;

    event.preventDefault();
    void submit();
  };

  const canSend = Boolean(text.trim() || image) && !sending && !preparing && !disabled;

  return (
    <div className={styles.composer}>
      {image && (
        <div className={styles.attachment}>
          <img className={styles.attachmentThumb} src={image} alt="Attached preview" />
          <button
            type="button"
            className={styles.attachmentRemove}
            onClick={() => setImage(null)}
            aria-label="Remove photo"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <p className={styles.composerError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.composerRow}>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className={styles.fileInput}
          onChange={pickImage}
          tabIndex={-1}
        />
        <button
          type="button"
          className={styles.composerButton}
          onClick={() => fileRef.current?.click()}
          disabled={disabled || preparing}
          aria-label="Add a photo"
          title="Add a photo"
        >
          {preparing ? <Loader2 size={21} className={styles.spin} /> : <ImagePlus size={21} />}
        </button>

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          rows={1}
          placeholder="Message"
          disabled={disabled}
          onChange={(event) => {
            setText(event.target.value);
            pingTyping();
          }}
          onBlur={() => stopTyping()}
          onKeyDown={onKeyDown}
          /* Sentences get capitalised, handles do not — this is prose. */
          autoCapitalize="sentences"
          autoCorrect="on"
          enterKeyHint="enter"
          aria-label="Message"
        />

        <button
          type="button"
          className={styles.sendButton}
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Send message"
        >
          {sending ? <Loader2 size={20} className={styles.spin} /> : <SendHorizontal size={20} />}
        </button>
      </div>
    </div>
  );
}
