import { describe, expect, it, vi } from 'vitest';

import type { PickedImage } from './device-photos';
import { recoverPendingPhotos } from './pending-photos';
import { draftReducer, EMPTY_DRAFT, type DraftAction, type ReportDraft } from './report-draft';

const image = (n: number): PickedImage => ({
  uri: `file:///pending-${n}.jpg`,
  width: 10,
  height: 10,
});
const prepared = (n: number) => ({
  id: `0000000${n}-2f3a-4b5c-9d0e-1f2a3b4c5d6e`,
  uri: `file:///prepared-${n}.jpg`,
  sizeBytes: 1000,
  width: 10,
  height: 10,
});

function setup(initial: ReportDraft, images: PickedImage[]) {
  let draft = initial;
  let n = 0;
  const deps = {
    take: vi.fn(async () => images),
    prepare: vi.fn(async () => prepared(++n)),
    apply: vi.fn(async (action: DraftAction) => (draft = draftReducer(draft, action))),
    getDraft: () => draft,
  };
  return {
    deps,
    get draft() {
      return draft;
    },
  };
}

const withPhotos = (count: number) =>
  Array.from({ length: count }, (_, i) => i + 1).reduce(
    (draft, n) =>
      draftReducer(draft, {
        type: 'addPhoto',
        photo: { ...prepared(n), id: `1000000${n}-2f3a-4b5c-9d0e-1f2a3b4c5d6e` },
      }),
    EMPTY_DRAFT,
  );

describe('recoverPendingPhotos', () => {
  it('adds the photo Android delivered after restarting the app', async () => {
    const s = setup(EMPTY_DRAFT, [image(1)]);
    expect(await recoverPendingPhotos(s.deps)).toBe(1);
    expect(s.draft.photos).toHaveLength(1);
  });

  it('does nothing when there is no pending result', async () => {
    const s = setup(EMPTY_DRAFT, []);
    expect(await recoverPendingPhotos(s.deps)).toBe(0);
    expect(s.deps.prepare).not.toHaveBeenCalled();
  });

  it('respects the photo limit', async () => {
    const s = setup(withPhotos(4), [image(1), image(2)]);
    expect(await recoverPendingPhotos(s.deps)).toBe(1);
    expect(s.draft.photos).toHaveLength(5);
    expect(s.deps.prepare).toHaveBeenCalledTimes(1);
  });

  it('never adds to a report that was already sent', async () => {
    const sent = draftReducer(EMPTY_DRAFT, {
      type: 'submitted',
      submission: {
        reportId: '9c4d5e6f-3a4b-4c5d-8e0f-2a3b4c5d6e7f',
        trackingNumber: 'T',
        municipalityId: '6f1f2b9e-6a8f-4d0e-9c8e-1d2a3b4c5d6e',
      },
    });
    const s = setup(sent, [image(1)]);
    expect(await recoverPendingPhotos(s.deps)).toBe(0);
    expect(s.deps.prepare).not.toHaveBeenCalled();
  });

  it('skips a photo that cannot be prepared and keeps the others', async () => {
    const s = setup(EMPTY_DRAFT, [image(1), image(2)]);
    s.deps.prepare.mockRejectedValueOnce(new Error('broken'));
    expect(await recoverPendingPhotos(s.deps)).toBe(1);
  });
});
