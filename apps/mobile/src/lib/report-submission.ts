/**
 * Sends a report draft: the report once, then each photo. Pure (all I/O is passed in) so the
 * retry rules can be unit-tested:
 *
 * 1. `submitReport` runs only while the draft has no `submission`. Its result is applied and
 *    persisted before any photo work, so a crash or retry can never create a second report.
 * 2. Photos are attached one by one with their fixed `photoId` (fixed storage path). A photo
 *    already uploaded is only registered again; a registered photo is skipped.
 * 3. A photo failure never undoes the report: the outcome is "partial" and can be retried.
 */
import {
  isApiError,
  reportSubmissionIssue,
  type AttachReportPhotoInput,
  type ReportSubmissionIssue,
  type SmartCityClient,
  type SubmitReportInput,
  type SubmittedReport,
} from '@smart-city/api';
import type { MessageKey } from '@smart-city/shared/i18n';

import { apiErrorMessageKey } from './api-error-message';
import { toSubmitReportInput, type DraftAction, type ReportDraft } from './report-draft';

export interface SubmissionServices {
  submitReport: (client: SmartCityClient, input: SubmitReportInput) => Promise<SubmittedReport>;
  attachReportPhoto: (client: SmartCityClient, input: AttachReportPhotoInput) => Promise<unknown>;
  /** The prepared photo's bytes (read again from the device for each upload attempt). */
  readPhotoBytes: (uri: string) => Promise<Uint8Array>;
}

/** Applies an action to the draft, persists it, and returns the new draft. */
export type ApplyDraftAction = (action: DraftAction) => Promise<ReportDraft>;

export type SendProgress = { phase: 'report' } | { phase: 'photo'; current: number; total: number };

export type SendOutcome =
  /** The report and every photo are in. */
  | { kind: 'sent' }
  /** The report is in; some photos are not attached. */
  | { kind: 'partial'; failed: number; retryable: boolean }
  /** Nothing was created; the draft can be fixed or sent again. */
  | { kind: 'not_sent'; error: MessageKey; issue: ReportSubmissionIssue | null };

/** Reasons that need the citizen to change something, and where. */
export const ISSUE_MESSAGES: Partial<Record<ReportSubmissionIssue, MessageKey>> = {
  outside_municipality: 'reportFlow.outsideMunicipality',
  category_unavailable: 'reportFlow.categoryUnavailable',
  municipality_unavailable: 'reportFlow.municipalityUnavailable',
  rate_limited: 'reportFlow.rateLimited',
  photos_closed: 'reportFlow.photosClosed',
  photo_limit: 'reportFlow.photoLimitReached',
  photo_invalid: 'reportFlow.errors.photoInvalid',
};

/** Photo failures that another attempt cannot fix. */
const FINAL_PHOTO_ISSUES: readonly ReportSubmissionIssue[] = [
  'photos_closed',
  'photo_limit',
  'photo_invalid',
];

export function submissionErrorKey(error: unknown): MessageKey {
  const issue = reportSubmissionIssue(error);
  if (issue && ISSUE_MESSAGES[issue]) return ISSUE_MESSAGES[issue];
  if (isApiError(error) && error.code === 'unauthorized') return 'reportFlow.signInToSubmit';
  return apiErrorMessageKey(error);
}

class UnreadablePhotoError extends Error {}

export async function sendReport(
  client: SmartCityClient,
  initial: ReportDraft,
  apply: ApplyDraftAction,
  services: SubmissionServices,
  onProgress: (progress: SendProgress) => void = () => {},
): Promise<SendOutcome> {
  let draft = initial;

  if (!draft.submission) {
    onProgress({ phase: 'report' });
    let report: SubmittedReport;
    try {
      report = await services.submitReport(client, toSubmitReportInput(draft));
    } catch (error) {
      return {
        kind: 'not_sent',
        error: submissionErrorKey(error),
        issue: reportSubmissionIssue(error),
      };
    }
    // Persisted before anything else: from here on, retries never submit again.
    draft = await apply({
      type: 'submitted',
      submission: { ...report, municipalityId: toSubmitReportInput(draft).municipalityId },
    });
  }

  const submission = draft.submission!;
  const pending = draft.photos.filter((photo) => !photo.registered);
  for (const [index, photo] of pending.entries()) {
    onProgress({ phase: 'photo', current: index + 1, total: pending.length });
    try {
      let bytes: Uint8Array | undefined;
      if (!photo.uploaded) {
        try {
          bytes = await services.readPhotoBytes(photo.uri);
        } catch {
          throw new UnreadablePhotoError();
        }
      }
      await services.attachReportPhoto(client, {
        municipalityId: submission.municipalityId,
        reportId: submission.reportId,
        photoId: photo.id,
        mimeType: photo.mimeType,
        bytes,
        uploaded: photo.uploaded,
        onUploaded: async () => {
          draft = await apply({ type: 'photoUploaded', id: photo.id });
        },
      });
      draft = await apply({ type: 'photoRegistered', id: photo.id });
    } catch (error) {
      const unreadable = error instanceof UnreadablePhotoError;
      const issue = reportSubmissionIssue(error);
      draft = await apply({
        type: 'photoFailed',
        id: photo.id,
        error: unreadable ? 'reportFlow.photoUnreadable' : submissionErrorKey(error),
        retryable: !unreadable && !(issue && FINAL_PHOTO_ISSUES.includes(issue)),
      });
    }
  }

  const failed = draft.photos.filter((photo) => !photo.registered);
  if (failed.length === 0) return { kind: 'sent' };
  return { kind: 'partial', failed: failed.length, retryable: failed.some((p) => p.retryable) };
}
