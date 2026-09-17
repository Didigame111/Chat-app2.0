import { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  /** Red styling and an alert icon, for anything that destroys data. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the safe option, not the destructive one: a stray Return on an
    // attached iPad keyboard should never be what deletes a conversation.
    cancelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={() => !busy && onCancel()}
    >
      <div className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        {destructive && (
          <span className={styles.warnMark} aria-hidden="true">
            <AlertTriangle size={22} />
          </span>
        )}
        <h2 className={styles.title} id="confirm-title">
          {title}
        </h2>
        <p className={styles.body}>{body}</p>
        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={destructive ? styles.confirmDanger : styles.confirm}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Loader2 size={17} className={styles.spin} /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
