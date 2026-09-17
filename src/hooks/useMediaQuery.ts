import { useEffect, useState } from 'react';

export function useMediaQuery(queryString: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(queryString).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(queryString);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', handler);
    return () => list.removeEventListener('change', handler);
  }, [queryString]);

  return matches;
}

/**
 * The single breakpoint that drives the whole layout.
 *
 * 1000px is chosen deliberately: an iPad 9th gen in landscape is 1080pt wide
 * and a 10th gen is 1180pt, so both get the permanent two-pane split. Held in
 * portrait they are 810pt and 820pt, which falls below the line and collapses
 * the conversation list into a drawer. Because the test is width and not a
 * device sniff, iPadOS Split View and Stage Manager get the right layout too:
 * Schoology in a half-screen pane behaves like portrait, full screen like landscape.
 */
export function useSplitLayout(): boolean {
  return useMediaQuery('(min-width: 1000px)');
}
