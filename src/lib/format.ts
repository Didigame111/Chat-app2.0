import type { Timestamp } from 'firebase/firestore';

export function toMillis(value: Timestamp | null | undefined): number {
  return value?.toMillis?.() ?? 0;
}

export function formatClock(millis: number): string {
  if (!millis) return '';
  return new Date(millis).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "Today" / "Yesterday" / "Mon 3 Mar" — the separator between message groups. */
export function formatDayLabel(millis: number): string {
  if (!millis) return '';
  const date = new Date(millis);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(date)) / 86_400_000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined });
}

/** Compact stamp for the conversation list. */
export function formatListTime(millis: number): string {
  if (!millis) return '';
  const date = new Date(millis);
  const sameDay = new Date().toDateString() === date.toDateString();
  if (sameDay) return formatClock(millis);
  const days = (Date.now() - millis) / 86_400_000;
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function initialsOf(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}
