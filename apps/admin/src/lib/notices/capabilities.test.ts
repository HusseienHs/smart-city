import { describe, expect, it } from 'vitest';

import {
  announcementDisplayState,
  canDeleteDraft,
  canDraftAnnouncements,
  canEditAnnouncement,
  canPostMunicipalityWide,
  canPublishAnnouncement,
} from './capabilities';

const OWN = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('canDraftAnnouncements', () => {
  it('mirrors can_draft_content', () => {
    expect(canDraftAnnouncements('municipality_admin', null)).toBe(true);
    expect(canDraftAnnouncements('department_manager', OWN)).toBe(true);
    expect(canDraftAnnouncements('employee', OWN)).toBe(true);
    expect(canDraftAnnouncements('employee', null)).toBe(false);
    expect(canDraftAnnouncements('intake_dispatcher', null)).toBe(false);
    expect(canDraftAnnouncements('platform_admin', null)).toBe(false);
  });
});

describe('canPostMunicipalityWide', () => {
  it('is municipality admins only', () => {
    expect(canPostMunicipalityWide('municipality_admin')).toBe(true);
    expect(canPostMunicipalityWide('department_manager')).toBe(false);
  });
});

describe('canPublishAnnouncement', () => {
  it('mirrors can_publish_content', () => {
    expect(canPublishAnnouncement('municipality_admin', null, null)).toBe(true);
    expect(canPublishAnnouncement('municipality_admin', null, OTHER)).toBe(true);
    expect(canPublishAnnouncement('department_manager', OWN, OWN)).toBe(true);
    expect(canPublishAnnouncement('department_manager', OWN, OTHER)).toBe(false);
    expect(canPublishAnnouncement('department_manager', OWN, null)).toBe(false);
    expect(canPublishAnnouncement('employee', OWN, OWN)).toBe(false);
  });
});

describe('canDeleteDraft', () => {
  it('offers publishers and employees of the department', () => {
    expect(canDeleteDraft('department_manager', OWN, OWN)).toBe(true);
    expect(canDeleteDraft('employee', OWN, OWN)).toBe(true);
    expect(canDeleteDraft('employee', OWN, OTHER)).toBe(false);
    expect(canDeleteDraft('employee', OWN, null)).toBe(false);
  });
});

describe('canEditAnnouncement', () => {
  const draft = (department_id: string | null) => ({ status: 'draft' as const, department_id });
  const published = (department_id: string | null) => ({
    status: 'published' as const,
    department_id,
  });
  it('lets publishers edit their content and staff edit their department drafts', () => {
    expect(canEditAnnouncement('municipality_admin', null, published(null))).toBe(true);
    expect(canEditAnnouncement('department_manager', OWN, published(OWN))).toBe(true);
    expect(canEditAnnouncement('department_manager', OWN, published(OTHER))).toBe(false);
    expect(canEditAnnouncement('employee', OWN, draft(OWN))).toBe(true);
    expect(canEditAnnouncement('employee', OWN, published(OWN))).toBe(false);
    expect(canEditAnnouncement('employee', OWN, draft(OTHER))).toBe(false);
  });
  it('never offers archived announcements', () => {
    expect(
      canEditAnnouncement('municipality_admin', null, { status: 'archived', department_id: null }),
    ).toBe(false);
  });
});

describe('announcementDisplayState', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  it('derives what residents see', () => {
    expect(announcementDisplayState({ status: 'draft', expires_at: null }, now)).toBe('draft');
    expect(announcementDisplayState({ status: 'archived', expires_at: null }, now)).toBe(
      'archived',
    );
    expect(announcementDisplayState({ status: 'published', expires_at: null }, now)).toBe('live');
    expect(
      announcementDisplayState({ status: 'published', expires_at: '2026-11-16T00:00:00Z' }, now),
    ).toBe('live');
    expect(
      announcementDisplayState({ status: 'published', expires_at: '2026-11-15T11:00:00Z' }, now),
    ).toBe('expired');
  });
});
