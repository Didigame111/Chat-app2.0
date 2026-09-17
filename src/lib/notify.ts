/**
 * Local notifications.
 *
 * Real push (Firebase Cloud Messaging fan-out) needs a server to hold the
 * sender key, and a server means Cloud Functions, and Cloud Functions means
 * the Blaze plan and a credit card. So Aura raises notifications from the page
 * itself: when a message arrives on an open connection while you are looking
 * somewhere else, you still get a banner. On iPadOS this works in Safari and,
 * once Aura is added to the Home Screen, in the installed app too (iPadOS
 * 16.4+).
 */

export type Permission = 'default' | 'granted' | 'denied' | 'unsupported';

export function notificationSupport(): Permission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as Permission;
}

export async function requestNotificationPermission(): Promise<Permission> {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return (await Notification.requestPermission()) as Permission;
  } catch {
    return 'denied';
  }
}

export function notify(title: string, body: string, tag: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    // Routed through the service worker when one is active: on iPadOS an
    // installed web app can only show notifications that way.
    navigator.serviceWorker?.ready
      .then((registration) =>
        registration.showNotification(title, {
          body,
          tag,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        }),
      )
      .catch(() => {
        new Notification(title, { body, tag, icon: '/icon-192.png' });
      });
  } catch {
    /* Notifications are a nicety; never let them break sending a message. */
  }
}

/** Short, plain-text preview for a banner. */
export function previewOf(text: string, hasImage: boolean): string {
  if (text.trim()) return text.trim().slice(0, 140);
  return hasImage ? 'Sent a photo' : 'New message';
}
