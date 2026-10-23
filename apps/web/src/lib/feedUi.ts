/** Lightweight bridge so Shell can show Bookmark inside the tab bar (not over X). */

export type FeedChromeState = {
  canBookmark: boolean;
  busy: boolean;
  onBookmark: (() => void) | null;
};

type Listener = (state: FeedChromeState) => void;

let state: FeedChromeState = {
  canBookmark: false,
  busy: false,
  onBookmark: null,
};

const listeners = new Set<Listener>();

export function getFeedChromeState(): FeedChromeState {
  return state;
}

export function setFeedChromeState(next: Partial<FeedChromeState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

export function subscribeFeedChrome(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function clearFeedChromeState(): void {
  setFeedChromeState({ canBookmark: false, busy: false, onBookmark: null });
}
