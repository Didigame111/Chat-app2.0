import { useEffect, useState, type ReactNode } from 'react';
import {
  notificationSupport,
  requestNotificationPermission,
  type Permission,
} from '../lib/notify';

interface NotificationPromptProps {
  render: (state: Permission, request: () => void) => ReactNode;
}

/**
 * iPadOS only honours Notification.requestPermission() inside a real user
 * gesture, and only at all once the app is on the Home Screen (iPadOS 16.4+).
 * So this never asks on its own — it hands the caller a button to render.
 */
export function NotificationPrompt({ render }: NotificationPromptProps) {
  const [state, setState] = useState<Permission>('unsupported');

  useEffect(() => setState(notificationSupport()), []);

  const request = () => {
    void requestNotificationPermission().then(setState);
  };

  return <>{render(state, request)}</>;
}
