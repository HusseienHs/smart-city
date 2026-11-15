/**
 * Geometry for Explore: the map area sent to `get_public_reports` (which refuses areas wider
 * than 0.5° per side), distances and their display. Pure, so it is unit-tested.
 */
export interface Point {
  latitude: number;
  longitude: number;
}

export interface Area {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** A react-native-maps style region. */
export interface Region extends Point {
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Slightly under the database's 0.5° limit, so rounding never trips it. */
export const MAX_AREA_SPAN = 0.49;
const KM_PER_DEGREE = 111.32;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The area within `radiusKm` of a point (a square, clamped to the allowed span). */
export function areaAround(center: Point, radiusKm = 3): Area {
  const latSpan = clamp((radiusKm / KM_PER_DEGREE) * 2, 0.001, MAX_AREA_SPAN);
  const cos = Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01);
  const lonSpan = clamp((radiusKm / (KM_PER_DEGREE * cos)) * 2, 0.001, MAX_AREA_SPAN);
  return boxAround(center, latSpan, lonSpan);
}

/** The visible map region as an area; a zoomed-out region is cut to the allowed span. */
export function regionToArea(region: Region): Area {
  return boxAround(
    region,
    clamp(region.latitudeDelta, 0.001, MAX_AREA_SPAN),
    clamp(region.longitudeDelta, 0.001, MAX_AREA_SPAN),
  );
}

/** The map region showing an area. */
export function areaToRegion(area: Area): Region {
  return {
    latitude: (area.north + area.south) / 2,
    longitude: (area.east + area.west) / 2,
    latitudeDelta: area.north - area.south,
    longitudeDelta: area.east - area.west,
  };
}

function boxAround(center: Point, latSpan: number, lonSpan: number): Area {
  const south = clamp(center.latitude - latSpan / 2, -90, 90);
  const north = clamp(center.latitude + latSpan / 2, -90, 90);
  const west = clamp(center.longitude - lonSpan / 2, -180, 180);
  const east = clamp(center.longitude + lonSpan / 2, -180, 180);
  return { south: round(south), west: round(west), north: round(north), east: round(east) };
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** Great-circle distance in kilometers. */
export function distanceKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "350 m" under a kilometer (to the nearest 50 m), otherwise kilometers with one decimal. */
export function displayDistance(km: number): { unit: 'm' | 'km'; value: string } {
  if (km < 1) return { unit: 'm', value: String(Math.max(50, Math.round((km * 1000) / 50) * 50)) };
  return { unit: 'km', value: km < 10 ? km.toFixed(1) : String(Math.round(km)) };
}

/** Nearest first; without an origin, the original (newest first) order is kept. */
export function sortByDistance<T extends Point>(items: readonly T[], origin: Point | null): T[] {
  if (!origin) return [...items];
  return [...items]
    .map((item) => ({ item, d: distanceKm(origin, item) }))
    .sort((a, b) => a.d - b.d)
    .map(({ item }) => item);
}

/** True when two areas differ enough to be worth a new request (map panning). */
export function areaChanged(a: Area, b: Area, tolerance = 0.15): boolean {
  const spanLat = Math.max(a.north - a.south, 1e-6);
  const spanLon = Math.max(a.east - a.west, 1e-6);
  return (
    Math.abs(a.south - b.south) / spanLat > tolerance ||
    Math.abs(a.north - b.north) / spanLat > tolerance ||
    Math.abs(a.west - b.west) / spanLon > tolerance ||
    Math.abs(a.east - b.east) / spanLon > tolerance
  );
}
