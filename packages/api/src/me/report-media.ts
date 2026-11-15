import { z } from 'zod';

import type { SmartCityClient } from '../client';
import type { Database } from '../database.types';
import { signReportMediaPaths } from '../staff/media';
import { runListQuery } from '../utils/query';
import { requireUserId } from '../utils/session';
import { parseInput } from '../utils/validation';

/*
 * Photos of the caller's own reports. `get_my_report_attachments` returns attachments of reports
 * the caller filed only (reporter_id = auth.uid()); the private report-media bucket's read policy
 * (private.can_read_report_media) lets the reporter read them. Signed URLs are created as the
 * caller, expire after a few minutes and must not be stored or shared.
 */

type AttachmentRow =
  Database['public']['Functions']['get_my_report_attachments']['Returns'][number];
export type MyReportAttachment = AttachmentRow;

export interface MyReportPhoto {
  attachmentId: string;
  kind: AttachmentRow['kind'];
  /** Short-lived URL for displaying the photo; null if it could not be signed. */
  url: string | null;
}

const reportScopeSchema = z.strictObject({ reportId: z.uuid() });

/** The attachments of one of the caller's reports, oldest first. Others' reports: empty. */
export async function getMyReportAttachments(
  client: SmartCityClient,
  input: { reportId: string },
): Promise<MyReportAttachment[]> {
  const { reportId } = parseInput(reportScopeSchema, input);
  await requireUserId(client);
  return runListQuery(client.rpc('get_my_report_attachments', { p_report_id: reportId }));
}

/** The photos of one of the caller's reports with short-lived signed URLs. */
export async function getMyReportPhotos(
  client: SmartCityClient,
  input: { reportId: string },
): Promise<MyReportPhoto[]> {
  const attachments = await getMyReportAttachments(client, input);
  if (attachments.length === 0) return [];
  const urls = await signReportMediaPaths(
    client,
    attachments.map((item) => item.storage_path),
    {},
  );
  return attachments.map((item) => ({
    attachmentId: item.id,
    kind: item.kind,
    url: urls.get(item.storage_path) ?? null,
  }));
}
