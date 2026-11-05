import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';

import { EMPTY_DRAFT, type DraftAction, type ReportDraft } from './report-draft';
import { createDraftStore } from './report-draft-store';

interface ReportDraftContextValue {
  draft: ReportDraft;
  /** The saved draft is still being read: show a loader rather than an empty form. */
  restoring: boolean;
  dispatch: (action: DraftAction) => void;
  /** Like dispatch, but resolves with the new draft once it is saved on the device. */
  apply: (action: DraftAction) => Promise<ReportDraft>;
  /** The latest draft right now (newer than `draft` inside a running async handler). */
  getDraft: () => ReportDraft;
}

const ReportDraftContext = createContext<ReportDraftContextValue | null>(null);

interface ReportDraftProviderProps extends PropsWithChildren {
  /** Who the draft belongs to (user id, or null when signed out). */
  owner: string | null;
}

/**
 * Holds the report being written, saved on the device per user (it survives restarts,
 * including a sent report whose photos are not all attached yet). Mounted above the navigator,
 * so navigation keeps the data; another account's draft is never shown.
 */
export function ReportDraftProvider({ owner, children }: ReportDraftProviderProps) {
  const [store] = useState(() => createDraftStore(AsyncStorage));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    store.setOwner(owner);
  }, [store, owner]);

  // Until the effect above runs for a new owner, show nothing of the previous one.
  const current = snapshot.owner === owner;
  const value = useMemo<ReportDraftContextValue>(
    () => ({
      draft: current ? snapshot.draft : EMPTY_DRAFT,
      restoring: current ? snapshot.restoring : owner !== null,
      dispatch: (action) => void store.apply(action),
      apply: store.apply,
      getDraft: () => store.getSnapshot().draft,
    }),
    [current, snapshot, owner, store],
  );
  return <ReportDraftContext value={value}>{children}</ReportDraftContext>;
}

export function useReportDraft(): ReportDraftContextValue {
  const context = use(ReportDraftContext);
  if (!context) throw new Error('useReportDraft must be used inside <ReportDraftProvider>');
  return context;
}
