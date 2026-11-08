/**
 * Recovers photos taken just before Android destroyed the app (see takePendingPhotos).
 * Pure (all I/O passed in) so it can be unit-tested; the app wires it up in
 * components/report/pending-photo-recovery.
 */
import { MAX_REPORT_PHOTOS } from '@smart-city/shared';

import type { PickedImage } from './device-photos';
import type { DraftAction, NewDraftPhoto, ReportDraft } from './report-draft';

export interface PendingPhotoDeps {
  take: () => Promise<PickedImage[]>;
  prepare: (image: PickedImage) => Promise<NewDraftPhoto>;
  apply: (action: DraftAction) => Promise<ReportDraft>;
  getDraft: () => ReportDraft;
}

/**
 * Adds the pending photos to the restored draft, with the same rules as a normal pick: never to
 * a report that was already sent, never beyond the photo limit. Returns how many were added.
 */
export async function recoverPendingPhotos(deps: PendingPhotoDeps): Promise<number> {
  const images = await deps.take();
  let added = 0;
  for (const image of images) {
    const draft = deps.getDraft();
    if (draft.submission || draft.photos.length >= MAX_REPORT_PHOTOS) break;
    try {
      const before = draft.photos.length;
      const next = await deps.apply({ type: 'addPhoto', photo: await deps.prepare(image) });
      if (next.photos.length > before) added += 1;
    } catch {
      // A photo that can't be prepared is skipped, like in a normal pick.
    }
  }
  return added;
}
