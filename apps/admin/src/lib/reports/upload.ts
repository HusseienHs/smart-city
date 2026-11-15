import { REPORT_MEDIA_BUCKET, storageErrorStatus, type ReportPhotoMimeType } from '@smart-city/api';
import { ALLOWED_REPORT_PHOTO_TYPES } from '@smart-city/shared';

/**
 * Direct browser → Supabase Storage upload, as the signed-in user, with progress events.
 *
 * supabase-js's upload() has no progress callback, so this sends the same request it would
 * (POST /storage/v1/object/{bucket}/{path}, the user's access token, `x-upsert: false`) with
 * XMLHttpRequest. The storage policy decides whether the upload is allowed; the bytes never
 * pass through the dashboard's server.
 */

export type UploadOutcome = 'uploaded' | 'exists';

export type UploadFailureReason = 'refused' | 'session' | 'invalid' | 'network' | 'failed';

export class UploadFailure extends Error {
  constructor(readonly reason: UploadFailureReason) {
    super(`Upload failed: ${reason}`);
    this.name = 'UploadFailure';
  }
}

/**
 * The MIME type to send for a file. Some systems report HEIC photos with an empty type; the
 * extension is used then. Storage and the database check the real stored metadata again.
 */
export function photoMimeType(file: { type: string; name: string }): ReportPhotoMimeType | null {
  if ((ALLOWED_REPORT_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return file.type as ReportPhotoMimeType;
  }
  if (!file.type && /\.(heic|heif)$/i.test(file.name)) return 'image/heic';
  return null;
}

/** Maps a failed storage response to a reason (see storageErrorStatus for its two formats). */
export function uploadFailureReason(
  httpStatus: number,
  body: unknown,
): UploadFailureReason | 'exists' {
  const statusCode =
    typeof body === 'object' && body !== null && 'statusCode' in body
      ? String((body as { statusCode: unknown }).statusCode)
      : undefined;
  const status = storageErrorStatus({ status: httpStatus, statusCode });
  if (status === 409) return 'exists';
  if (status === 401) return 'session';
  if (status === 403) return 'refused';
  if (status === 400 || status === 413 || status === 415 || status === 422) return 'invalid';
  return 'failed';
}

export function uploadReportMedia(options: {
  supabaseUrl: string;
  publishableKey: string;
  accessToken: string;
  path: string;
  file: Blob;
  contentType: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<UploadOutcome> {
  const { supabaseUrl, publishableKey, accessToken, path, file, contentType, onProgress, signal } =
    options;
  const url = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${REPORT_MEDIA_BUCKET}/${path}`;

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.setRequestHeader('authorization', `Bearer ${accessToken}`);
    request.setRequestHeader('apikey', publishableKey);
    request.setRequestHeader('x-upsert', 'false');
    request.setRequestHeader('content-type', contentType);
    request.setRequestHeader('cache-control', 'max-age=3600');

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(1);
        resolve('uploaded');
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(request.responseText);
      } catch {
        body = undefined;
      }
      const reason = uploadFailureReason(request.status, body);
      if (reason === 'exists') resolve('exists');
      else reject(new UploadFailure(reason));
    };
    request.onerror = () => reject(new UploadFailure('network'));
    request.onabort = () => reject(new UploadFailure('network'));
    signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(file);
  });
}
