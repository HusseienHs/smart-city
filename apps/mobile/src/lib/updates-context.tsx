import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { AsyncControls, AsyncState } from '@/hooks/use-async';

import { useAuth } from './auth';
import { hasUnseenUpdates } from './home-dashboard';
import { useNoticeBoard, type NoticeBoard } from './notice-board';

interface UpdatesContextValue {
  board: AsyncState<NoticeBoard> & AsyncControls;
  /** Announcements were published since the citizen last opened Updates. */
  hasUnseen: boolean;
  /** Called when Updates is shown: clears the dot. */
  markSeen: () => void;
}

const UpdatesContext = createContext<UpdatesContextValue | null>(null);

const seenKey = (userId: string) => `updates-last-seen:${userId}`;

/**
 * The citizen's Notice Board, loaded once for the tabs (Home's news, the Updates tab and its
 * "new" dot). The last time Updates was opened is kept on this device only.
 */
export function UpdatesProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const board = useNoticeBoard(userId);
  const [lastSeen, setLastSeen] = useState<{ owner: string; at: string | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    AsyncStorage.getItem(seenKey(userId)).then(
      (value) => active && setLastSeen({ owner: userId, at: value }),
      () => active && setLastSeen({ owner: userId, at: null }),
    );
    return () => {
      active = false;
    };
  }, [userId]);

  const markSeen = useCallback(() => {
    if (!userId) return;
    const now = new Date().toISOString();
    setLastSeen({ owner: userId, at: now });
    void AsyncStorage.setItem(seenKey(userId), now).catch(() => undefined);
  }, [userId]);

  const announcements =
    board.status === 'success' && board.data.kind === 'ready' ? board.data.announcements : null;
  // Unknown until the saved timestamp of *this* user is read (no flash of a dot).
  const hasUnseen =
    announcements !== null &&
    lastSeen?.owner === userId &&
    hasUnseenUpdates(
      announcements.map((item) => item.published_at),
      lastSeen.at,
    );

  const value = useMemo(() => ({ board, hasUnseen, markSeen }), [board, hasUnseen, markSeen]);
  return <UpdatesContext value={value}>{children}</UpdatesContext>;
}

export function useUpdates(): UpdatesContextValue {
  const context = use(UpdatesContext);
  if (!context) throw new Error('useUpdates must be used inside <UpdatesProvider>');
  return context;
}
