import { ApiError, type Municipality, type PublishedAnnouncement } from '@smart-city/api';
import { getTextDirection } from '@smart-city/shared';
import { messages } from '@smart-city/shared/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  listCities: vi.fn(),
  listPublishedAnnouncements: vi.fn(),
}));

// The real package, with only the calls that would reach the network replaced.
vi.mock('@smart-city/api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));
vi.mock('./supabase', () => ({ getSupabase: () => ({}) }));

const {
  NOTICE_FILTERS,
  announcementSummary,
  countByFilter,
  filterAnnouncements,
  forgetNoticeBoard,
  isHighlighted,
  loadAnnouncement,
  loadNoticeBoard,
} = await import('./notice-board');

const client = {} as never;
const userA = 'a0000000-0000-4000-8000-00000000000a';
const userB = 'b0000000-0000-4000-8000-00000000000b';
const homeId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const neighborhoodId = '33333333-3333-4333-8333-333333333333';

const city = (id: string, status: Municipality['status'], en: string): Municipality => ({
  id,
  code: 'TLV',
  name: { he: en, ar: en, en },
  status,
  default_locale: 'he',
  timezone: 'Asia/Jerusalem',
  contact_email: null,
  contact_phone: null,
});

const announcement = (
  id: string,
  severity: PublishedAnnouncement['severity'],
  municipalityId = homeId,
): PublishedAnnouncement => ({
  id,
  municipality_id: municipalityId,
  department_id: null,
  neighborhood_id: null,
  title: { he: `כותרת ${id}`, ar: `عنوان ${id}`, en: `Title ${id}` },
  body: { he: 'גוף', ar: 'نص', en: 'Body' },
  severity,
  image_path: null,
  expires_at: null,
  published_at: '2026-11-07T08:00:00Z',
  created_at: '2026-11-07T07:00:00Z',
  updated_at: '2026-11-07T08:00:00Z',
});

const profile = (home: string | null, neighborhood: string | null = null) => ({
  id: userA,
  full_name: 'Dana',
  preferred_locale: 'he',
  home_municipality_id: home,
  home_neighborhood_id: neighborhood,
});

beforeEach(() => {
  vi.resetAllMocks();
  forgetNoticeBoard();
  api.listCities.mockResolvedValue([
    city(homeId, 'active', 'Tel Aviv-Yafo'),
    city(otherId, 'onboarding', 'Haifa'),
  ]);
  api.listPublishedAnnouncements.mockResolvedValue([]);
});

describe('loadNoticeBoard: which municipality', () => {
  it('loads the announcements of the citizen’s home municipality and neighborhood only', async () => {
    api.getMyProfile.mockResolvedValue(profile(homeId, neighborhoodId));
    api.listPublishedAnnouncements.mockResolvedValue([
      announcement('a1', 'emergency'),
      announcement('x1', 'info', otherId), // never shown, even if returned
      announcement('a2', 'info'),
    ]);
    const board = await loadNoticeBoard(client, userA);
    expect(api.listPublishedAnnouncements).toHaveBeenCalledWith(client, {
      municipalityId: homeId,
      neighborhoodId,
    });
    expect(board.kind).toBe('ready');
    if (board.kind !== 'ready') return;
    expect(board.city.name.en).toBe('Tel Aviv-Yafo');
    expect(board.announcements.map((item) => item.id)).toEqual(['a1', 'a2']);
  });

  it('without a home neighborhood, asks for municipality-wide announcements', async () => {
    api.getMyProfile.mockResolvedValue(profile(homeId));
    await loadNoticeBoard(client, userA);
    expect(api.listPublishedAnnouncements).toHaveBeenCalledWith(client, { municipalityId: homeId });
  });

  it('a city that hasn’t joined yet has no board, and nothing is requested', async () => {
    api.getMyProfile.mockResolvedValue(profile(otherId));
    const board = await loadNoticeBoard(client, userA);
    expect(board).toMatchObject({ kind: 'not-joined', city: { id: otherId } });
    expect(api.listPublishedAnnouncements).not.toHaveBeenCalled();
  });

  it('asks for a home city when none is set, or it is no longer listed', async () => {
    for (const home of [null, '44444444-4444-4444-8444-444444444444']) {
      api.getMyProfile.mockResolvedValueOnce(profile(home));
      expect(await loadNoticeBoard(client, userA)).toEqual({ kind: 'no-home' });
    }
    api.getMyProfile.mockResolvedValueOnce(null);
    expect(await loadNoticeBoard(client, userA)).toEqual({ kind: 'no-home' });
    expect(api.listPublishedAnnouncements).not.toHaveBeenCalled();
  });

  it('an empty board is a valid result (empty state)', async () => {
    api.getMyProfile.mockResolvedValue(profile(homeId));
    expect(await loadNoticeBoard(client, userA)).toMatchObject({
      kind: 'ready',
      announcements: [],
    });
  });

  it('errors reach the screen (error state with retry)', async () => {
    api.getMyProfile.mockResolvedValue(profile(homeId));
    api.listPublishedAnnouncements.mockRejectedValue(new ApiError('network'));
    await expect(loadNoticeBoard(client, userA)).rejects.toMatchObject({ code: 'network' });
  });
});

describe('loadAnnouncement', () => {
  beforeEach(() => {
    api.getMyProfile.mockResolvedValue(profile(homeId));
    api.listPublishedAnnouncements.mockResolvedValue([announcement('a1', 'important')]);
  });

  it('opens an announcement from the loaded board without another request', async () => {
    await loadNoticeBoard(client, userA);
    api.listPublishedAnnouncements.mockClear();
    const details = await loadAnnouncement(client, userA, 'a1');
    expect(details?.announcement.id).toBe('a1');
    expect(details?.city.id).toBe(homeId);
    expect(api.listPublishedAnnouncements).not.toHaveBeenCalled();
  });

  it('loads again for another user, or when opened directly', async () => {
    await loadNoticeBoard(client, userA);
    api.listPublishedAnnouncements.mockClear();
    await loadAnnouncement(client, userB, 'a1');
    expect(api.listPublishedAnnouncements).toHaveBeenCalledTimes(1);
  });

  it('is null when the announcement is no longer published', async () => {
    expect(await loadAnnouncement(client, userA, 'gone')).toBeNull();
  });
});

describe('filters and display', () => {
  const list = [
    announcement('e', 'emergency'),
    announcement('i1', 'important'),
    announcement('g1', 'info'),
    announcement('g2', 'info'),
  ];

  it('filters by the severity the municipality set', () => {
    expect(filterAnnouncements(list, 'all')).toHaveLength(4);
    expect(filterAnnouncements(list, 'emergency').map((a) => a.id)).toEqual(['e']);
    expect(filterAnnouncements(list, 'important').map((a) => a.id)).toEqual(['i1']);
    expect(filterAnnouncements(list, 'info').map((a) => a.id)).toEqual(['g1', 'g2']);
    expect(countByFilter(list)).toEqual({ all: 4, emergency: 1, important: 1, info: 2 });
  });

  it('highlights important and emergency announcements', () => {
    expect(isHighlighted('emergency')).toBe(true);
    expect(isHighlighted('important')).toBe(true);
    expect(isHighlighted('info')).toBe(false);
  });

  it('summarizes the body on one line, at a word boundary', () => {
    expect(announcementSummary('  Water\n\nshut-off  tomorrow ')).toBe('Water shut-off tomorrow');
    const long = 'word '.repeat(60);
    const summary = announcementSummary(long, 50);
    expect(summary.endsWith('…')).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(51);
    expect(summary).not.toMatch(/wo…$/);
    expect(announcementSummary('ניתוק מים מתוכנן ברחוב הרצל מחר בין השעות 8 ל-12', 20)).toMatch(
      /…$/,
    );
  });
});

describe('translations', () => {
  it('every filter, severity and screen text exists in Hebrew, Arabic and English', () => {
    for (const locale of ['en', 'he', 'ar'] as const) {
      const notices = messages[locale].notices;
      for (const filter of NOTICE_FILTERS) expect(notices.filters[filter]).toBeTruthy();
      for (const severity of ['info', 'important', 'emergency'] as const) {
        expect(notices.severity[severity]).toBeTruthy();
      }
      expect(notices.emptyDescription).toContain('{municipality}');
      expect(notices.notJoinedTitle).toContain('{municipality}');
      expect(notices.publishedOn).toContain('{date}');
      expect(messages[locale].mobileTabs.notices).toBeTruthy();
    }
  });

  it('Hebrew and Arabic are right-to-left, English left-to-right', () => {
    expect(getTextDirection('he')).toBe('rtl');
    expect(getTextDirection('ar')).toBe('rtl');
    expect(getTextDirection('en')).toBe('ltr');
  });
});
