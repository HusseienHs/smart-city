import type { StaffAnnouncement } from '@smart-city/api';

import type { AccessRole } from '@/lib/auth/permissions';

/**
 * What the Notice Board screens OFFER each role. User experience only: the Server Actions
 * re-check, and the database (can_draft_content / can_publish_content, RLS) decides.
 */

/** private.can_draft_content(): admins anything; employees/managers their own department. */
export function canDraftAnnouncements(role: AccessRole, ownDepartmentId: string | null): boolean {
  if (role === 'municipality_admin') return true;
  return (role === 'employee' || role === 'department_manager') && ownDepartmentId !== null;
}

/** Only municipality admins may post municipality-wide (no department). */
export function canPostMunicipalityWide(role: AccessRole): boolean {
  return role === 'municipality_admin';
}

/** private.can_publish_content(): admins all; managers their own department's content. */
export function canPublishAnnouncement(
  role: AccessRole,
  ownDepartmentId: string | null,
  announcementDepartmentId: string | null,
): boolean {
  if (role === 'municipality_admin') return true;
  return (
    role === 'department_manager' &&
    announcementDepartmentId !== null &&
    announcementDepartmentId === ownDepartmentId
  );
}

/**
 * Drafts can be deleted by publishers, or by their author (the author is not readable, so
 * employees of the department are offered it and the database refuses others' drafts).
 */
export function canDeleteDraft(
  role: AccessRole,
  ownDepartmentId: string | null,
  announcementDepartmentId: string | null,
): boolean {
  if (canPublishAnnouncement(role, ownDepartmentId, announcementDepartmentId)) return true;
  return (
    role === 'employee' &&
    announcementDepartmentId !== null &&
    announcementDepartmentId === ownDepartmentId
  );
}

/**
 * Edits (RLS update policy): publishers edit their content; a draft's author edits it. The
 * author is not readable, so department staff are offered drafts of their department and the
 * database refuses others' drafts. Archived announcements are final in the dashboard.
 */
export function canEditAnnouncement(
  role: AccessRole,
  ownDepartmentId: string | null,
  announcement: Pick<StaffAnnouncement, 'status' | 'department_id'>,
): boolean {
  if (announcement.status === 'archived') return false;
  if (canPublishAnnouncement(role, ownDepartmentId, announcement.department_id)) return true;
  return (
    announcement.status === 'draft' &&
    (role === 'employee' || role === 'department_manager') &&
    announcement.department_id !== null &&
    announcement.department_id === ownDepartmentId
  );
}

export type AnnouncementDisplayState = 'draft' | 'live' | 'expired' | 'archived';

/** A published announcement past its expiry is no longer shown to residents. */
export function announcementDisplayState(
  announcement: Pick<StaffAnnouncement, 'status' | 'expires_at'>,
  now: Date = new Date(),
): AnnouncementDisplayState {
  if (announcement.status === 'draft') return 'draft';
  if (announcement.status === 'archived') return 'archived';
  if (announcement.expires_at && new Date(announcement.expires_at) <= now) return 'expired';
  return 'live';
}
