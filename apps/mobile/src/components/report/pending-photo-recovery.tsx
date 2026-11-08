import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/lib/auth';
import { preparePhoto, takePendingPhotos } from '@/lib/device-photos';
import { recoverPendingPhotos } from '@/lib/pending-photos';
import { useReportDraft } from '@/lib/report-draft-context';

/**
 * Once per app start, after the signed-in user's draft is restored: adds a photo that Android
 * delivered after destroying and restarting the app (camera on low memory), then reopens the
 * photos step so the citizen sees it. Renders nothing. Android only in effect.
 */
export function PendingPhotoRecovery() {
  const { user } = useAuth();
  const { restoring, apply, getDraft } = useReportDraft();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || !user || restoring) return;
    checked.current = true;
    void recoverPendingPhotos({ take: takePendingPhotos, prepare: preparePhoto, apply, getDraft })
      .then((added) => {
        if (added > 0) router.push('/new-report/photos');
      })
      .catch(() => {
        // Nothing to recover.
      });
  }, [user, restoring, apply, getDraft]);

  return null;
}
