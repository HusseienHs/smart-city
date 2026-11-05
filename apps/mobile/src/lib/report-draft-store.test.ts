import { describe, expect, it } from 'vitest';

import type { KeyValueStore } from './password-recovery-state';
import {
  draftReducer,
  draftStorageKey,
  EMPTY_DRAFT,
  parseStoredDraft,
  serializeDraft,
} from './report-draft';
import { createDraftStore } from './report-draft-store';

const municipalityId = '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e';
const reportId = '9c4d5e6f-3a4b-4c5d-8e0f-2a3b4c5d6e7f';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  let gate: Promise<void> | null = null;
  const storage: KeyValueStore & { data: Map<string, string>; holdReads: () => () => void } = {
    data,
    async getItem(key) {
      if (gate) await gate;
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
    holdReads() {
      let open: () => void = () => {};
      gate = new Promise((resolve) => (open = resolve));
      return () => {
        gate = null;
        open();
      };
    },
  };
  return storage;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const stored = (storage: ReturnType<typeof memoryStorage>, owner: string) =>
  parseStoredDraft(storage.data.get(draftStorageKey(owner)) ?? null);

const sentDraft = draftReducer(
  { ...EMPTY_DRAFT, municipalityId, category: 'pothole', description: 'Deep pothole here' },
  {
    type: 'submitted',
    submission: { reportId, trackingNumber: 'TSA-2026-000001', municipalityId },
  },
);

describe('draft store', () => {
  it('saves each change and restores it for the same user', async () => {
    const storage = memoryStorage();
    const store = createDraftStore(storage);
    store.setOwner('user-1');
    await flush();
    await store.apply({ type: 'setDescription', description: 'Broken lamp' });
    expect(stored(storage, 'user-1')?.description).toBe('Broken lamp');

    const reopened = createDraftStore(storage);
    reopened.setOwner('user-1');
    expect(reopened.getSnapshot().restoring).toBe(true);
    await flush();
    expect(reopened.getSnapshot()).toMatchObject({ restoring: false });
    expect(reopened.getSnapshot().draft.description).toBe('Broken lamp');
  });

  it('never shows another user’s draft', async () => {
    const storage = memoryStorage({ [draftStorageKey('user-1')]: serializeDraft(sentDraft) });
    const store = createDraftStore(storage);
    store.setOwner('user-1');
    await flush();
    expect(store.getSnapshot().draft.submission?.reportId).toBe(reportId);
    store.setOwner('user-2');
    expect(store.getSnapshot().draft).toEqual(EMPTY_DRAFT);
    await flush();
    expect(store.getSnapshot().draft).toEqual(EMPTY_DRAFT);
    store.setOwner(null);
    expect(store.getSnapshot()).toMatchObject({ draft: EMPTY_DRAFT, restoring: false });
  });

  it('a sent report restored late wins over input typed meanwhile, and is not overwritten', async () => {
    const storage = memoryStorage({ [draftStorageKey('user-1')]: serializeDraft(sentDraft) });
    const release = storage.holdReads();
    const store = createDraftStore(storage);
    store.setOwner('user-1');
    const typed = store.apply({ type: 'setDescription', description: 'Something else' });
    release();
    await typed;
    await flush();
    expect(store.getSnapshot().draft.submission?.reportId).toBe(reportId);
    expect(stored(storage, 'user-1')?.submission?.reportId).toBe(reportId);
  });

  it('an empty draft removes the saved one', async () => {
    const storage = memoryStorage();
    const store = createDraftStore(storage);
    store.setOwner('user-1');
    await store.apply({ type: 'setDescription', description: 'x' });
    expect(storage.data.size).toBe(1);
    await store.apply({ type: 'reset' });
    expect(storage.data.size).toBe(0);
  });

  it('keeps working in memory when the device storage fails', async () => {
    const storage = memoryStorage();
    storage.setItem = async () => {
      throw new Error('disk full');
    };
    const store = createDraftStore(storage);
    store.setOwner('user-1');
    const draft = await store.apply({ type: 'setDescription', description: 'Still here' });
    expect(draft.description).toBe('Still here');
    expect(store.getSnapshot().draft.description).toBe('Still here');
  });

  it('notifies subscribers', async () => {
    const store = createDraftStore(memoryStorage());
    let calls = 0;
    const unsubscribe = store.subscribe(() => (calls += 1));
    await store.apply({ type: 'setDescription', description: 'a' });
    unsubscribe();
    await store.apply({ type: 'setDescription', description: 'b' });
    expect(calls).toBe(1);
  });
});
