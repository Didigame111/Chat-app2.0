import { useEffect } from 'react';

/**
 * Keeps the app exactly as tall as the *visible* area on iPadOS.
 *
 * Three things move that number on an iPad and none of them change
 * window.innerHeight reliably:
 *
 *   1. The on-screen keyboard, including the floating and split keyboards,
 *      which shrink the visual viewport without a window resize event.
 *   2. Safari's toolbar collapsing as you scroll.
 *   3. Stage Manager window resizing and Split View drags.
 *
 * visualViewport reports all three, so the layout keys off --app-height rather
 * than 100vh. Without this the message composer slides under the keyboard —
 * the single most common iPad web-chat bug.
 */
export function useViewportFit(): void {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;

    const apply = () => {
      const height = viewport?.height ?? window.innerHeight;
      root.style.setProperty('--app-height', `${Math.round(height)}px`);

      // When iPadOS scrolls the page up to reveal a focused field, the visual
      // viewport is offset from the layout viewport. Mirror that offset so the
      // fixed app shell stays glued to what the user can actually see.
      const offset = Math.round(viewport?.offsetTop ?? 0);
      root.style.setProperty('--viewport-offset', `${offset}px`);

      const keyboard = Math.max(
        0,
        Math.round(window.innerHeight - height - (viewport?.offsetTop ?? 0)),
      );
      root.style.setProperty('--keyboard-inset', `${keyboard}px`);
      root.dataset.keyboard = keyboard > 120 ? 'open' : 'closed';
    };

    apply();

    viewport?.addEventListener('resize', apply);
    viewport?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);

    return () => {
      viewport?.removeEventListener('resize', apply);
      viewport?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);
}

/**
 * Stops the whole page rubber-banding when a scroll gesture reaches the end of
 * the message list. Individual scrollers opt back in via
 * `overscroll-behavior: contain` in CSS; this only blocks drags that started
 * outside any scroller, which on iPadOS is what drags the entire web view.
 */
export function usePageBounceLock(): void {
  useEffect(() => {
    const onTouchMove = (event: TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-scrollable]')) {
        event.preventDefault();
      }
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => document.removeEventListener('touchmove', onTouchMove);
  }, []);
}
