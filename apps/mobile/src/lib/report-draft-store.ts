/**
 * The report draft of the signed-in user, kept in memory and saved on the device. Framework-free
 * (storage passed in) so restore and save ordering can be unit-tested; the React provider
 * subscribes to it.
 *
 * - One draft per owner (user id). Changing the owner clears memory and restores that owner's
 *   saved draft; another account's draft is never shown.
 * - Saves run one after another and always write the latest draft, so an older state can never
 *   overwrite a newer one (important once a report was sent: the report id must survive).
 * - Saving is best effort: if the device storage fails, the in-memory draft stays correct for
 *   this session.
 */
import {
  draftReducer,
  EMPTY_DRAFT,
  isDraftStarted,
  loadStoredDraft,
  saveStoredDraft,
  type DraftAction,
  type ReportDraft,
} from './report-draft';
import type { KeyValueStore } from './password-recovery-state';

export interface DraftSnapshot {
  owner: string | null;
  draft: ReportDraft;
  /** The owner's saved draft is still being read. */
  restoring: boolean;
}

export interface DraftStore {
  getSnapshot(): DraftSnapshot;
  subscribe(listener: () => void): () => void;
  setOwner(owner: string | null): void;
  /** Applies the action and resolves with the new draft once it is saved. */
  apply(action: DraftAction): Promise<ReportDraft>;
}

export function createDraftStore(storage: KeyValueStore): DraftStore {
  let snapshot: DraftSnapshot = { owner: null, draft: EMPTY_DRAFT, restoring: false };
  let generation = 0;
  let writes: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();

  function update(change: Partial<DraftSnapshot>) {
    snapshot = { ...snapshot, ...change };
    for (const listener of listeners) listener();
  }

  function save(owner: string, current: number): Promise<void> {
    writes = writes
      .then(async () => {
        // Always the latest draft of this owner; nothing once the owner changed.
        if (current === generation) await saveStoredDraft(storage, owner, snapshot.draft);
      })
      .catch(() => {
        // Best effort: the in-memory draft is still correct for this session.
      });
    return writes;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setOwner(owner) {
      if (owner === snapshot.owner) return;
      generation += 1;
      const current = generation;
      update({ owner, draft: EMPTY_DRAFT, restoring: owner !== null });
      if (owner === null) return;
      const restore = loadStoredDraft(storage, owner).then((saved) => {
        if (current !== generation) return;
        // A sent report always wins: its id must not be lost. Otherwise keep anything typed
        // while restoring.
        const keep = saved && (saved.submission !== null || !isDraftStarted(snapshot.draft));
        update({ draft: keep ? saved : snapshot.draft, restoring: false });
      });
      // Saves wait for the restore, so they never overwrite the saved draft before it is read.
      writes = writes.then(() => restore);
    },
    async apply(action) {
      const next = draftReducer(snapshot.draft, action);
      if (next === snapshot.draft) return next;
      update({ draft: next });
      if (snapshot.owner !== null) await save(snapshot.owner, generation);
      return next;
    },
  };
}
