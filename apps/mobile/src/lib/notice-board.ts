/**
 * The Notice Board: published announcements of the citizen's home municipality, via
 * @smart-city/api (`listPublishedAnnouncements`). Row Level Security only returns published,
 * unexpired announcements of municipalities that joined the platform (status `active`); this
 * module picks *which* municipality: the one in the citizen's profile.
 *
 * The loaders take the client as a parameter so they can be unit-tested; the hooks pass the app's.
 */
import {
  acceptsReports,
  announcementImageUrl,
  getMyProfile,
  listCities,
  listPublishedAnnouncements,
  type Municipality,
  type PublishedAnnouncement,
  type SmartCityClient,
} from '@smart-city/api';

// Relative (not '@/'), so the unit tests can load this module.
import { useAsync } from '../hooks/use-async';

import { getSupabase } from './supabase';

export type AnnouncementSeverity = PublishedAnnouncement['severity'];

/**
 * The filters the data supports. Announcements have no category column; their severity
 * (`info` / `important` / `emergency`) is what the municipality sets, shown as General /
 * Important / Emergency. Topic categories (maintenance, events…) would need a database change.
 */
export const NOTICE_FILTERS = ['all', 'emergency', 'important', 'info'] as const;
export type NoticeFilter = (typeof NOTICE_FILTERS)[number];

export type NoticeBoard =
  /** No home city in the profile (or it is no longer listed): ask the citizen to choose one. */
  | { kind: 'no-home' }
  /** The home city is listed but hasn't joined the platform: it can't publish yet. */
  | { kind: 'not-joined'; city: Municipality }
  | { kind: 'ready'; city: Municipality; announcements: PublishedAnnouncement[] };

// The last loaded board and whose it is, so opening an announcement shows it at once. Only
// ever reused for the same user (another account may live in another city).
let lastBoard: { owner: string; board: Extract<NoticeBoard, { kind: 'ready' }> } | null = null;

/** Clears the in-memory copy (sign-out, tests). */
export function forgetNoticeBoard(): void {
  lastBoard = null;
}

/**
 * The citizen's Notice Board. Announcements are requested only for the home municipality, with
 * the home neighborhood (if set) so neighborhood notices are included as well.
 */
export async function loadNoticeBoard(
  client: SmartCityClient,
  owner: string,
): Promise<NoticeBoard> {
  const [profile, cities] = await Promise.all([getMyProfile(client), listCities(client)]);
  const homeId = profile?.home_municipality_id ?? null;
  const city = homeId ? cities.find((item) => item.id === homeId) : undefined;
  if (!city) return { kind: 'no-home' };
  if (!acceptsReports(city)) return { kind: 'not-joined', city };

  const announcements = await listPublishedAnnouncements(client, {
    municipalityId: city.id,
    ...(profile?.home_neighborhood_id ? { neighborhoodId: profile.home_neighborhood_id } : {}),
  });
  // Defense in depth: never show another municipality's announcement.
  const own = announcements.filter((item) => item.municipality_id === city.id);
  const board = { kind: 'ready' as const, city, announcements: own };
  lastBoard = { owner, board };
  return board;
}

export interface AnnouncementDetails {
  announcement: PublishedAnnouncement;
  city: Municipality;
}

/** One announcement: from the last loaded board, else loaded again. Null if no longer listed. */
export async function loadAnnouncement(
  client: SmartCityClient,
  owner: string,
  id: string,
): Promise<AnnouncementDetails | null> {
  const mine = lastBoard?.owner === owner ? lastBoard.board : null;
  const cached = mine?.announcements.find((item) => item.id === id);
  if (mine && cached) return { announcement: cached, city: mine.city };
  const board = await loadNoticeBoard(client, owner);
  if (board.kind !== 'ready') return null;
  const announcement = board.announcements.find((item) => item.id === id);
  return announcement ? { announcement, city: board.city } : null;
}

export function filterAnnouncements(
  announcements: readonly PublishedAnnouncement[],
  filter: NoticeFilter,
): PublishedAnnouncement[] {
  return filter === 'all'
    ? [...announcements]
    : announcements.filter((item) => item.severity === filter);
}

export function countByFilter(
  announcements: readonly PublishedAnnouncement[],
): Record<NoticeFilter, number> {
  const counts: Record<NoticeFilter, number> = { all: 0, emergency: 0, important: 0, info: 0 };
  for (const item of announcements) {
    counts.all += 1;
    counts[item.severity] += 1;
  }
  return counts;
}

/** The short description on a card: the body on one line, cut at a word boundary. */
export function announcementSummary(body: string, maxLength = 140): string {
  const text = body.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Important and emergency announcements are highlighted. */
export function isHighlighted(severity: AnnouncementSeverity): boolean {
  return severity !== 'info';
}

/** Public URL of the announcement's image, or null (built locally; no request). */
export function noticeImageUrl(imagePath: string | null): string | null {
  return announcementImageUrl(getSupabase(), imagePath);
}

/** The Notice Board of the signed-in user (null user = nothing loaded). */
export function useNoticeBoard(userId: string | null) {
  return useAsync<NoticeBoard>(userId ? `notice-board:${userId}` : null, () =>
    loadNoticeBoard(getSupabase(), userId!),
  );
}

export function useAnnouncement(userId: string | null, id: string | undefined) {
  return useAsync<AnnouncementDetails | null>(userId && id ? `${userId}:${id}` : null, () =>
    loadAnnouncement(getSupabase(), userId!, id!),
  );
}
