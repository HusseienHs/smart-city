import { ApiError } from '../errors/api-error';

/**
 * Decoding of PostGIS point values as returned by the API.
 *
 * PostgREST serializes a `geography(Point, 4326)` column with PostGIS's text output: hex-encoded
 * EWKB, e.g. `0101000020E6100000<x:float64><y:float64>` — little-endian (NDR), point type with
 * the SRID flag, SRID 4326, then X = longitude and Y = latitude. (Verified against PostGIS 3.6,
 * the version used by the database tests.) Plain WKB without an SRID and big-endian (XDR)
 * encodings are accepted too, since they are equally valid encodings of the same point.
 *
 * Only what the schema can contain is accepted: a 2D point in WGS 84 (SRID 4326). Anything
 * else — another geometry type, Z/M dimensions, another SRID, out-of-range or non-finite
 * coordinates, or trailing bytes — is rejected rather than guessed at.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const WKB_POINT = 1;
const EWKB_Z = 0x80000000;
const EWKB_M = 0x40000000;
const EWKB_SRID = 0x20000000;
const WGS84 = 4326;

export class WkbError extends Error {
  constructor(reason: string) {
    super(`Invalid WKB point: ${reason}`);
    this.name = 'WkbError';
  }
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new WkbError('not a hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * Decodes a hex (E)WKB 2D point into latitude/longitude. Returns null for `POINT EMPTY` (encoded
 * by PostGIS as NaN coordinates). Throws WkbError for anything that isn't a valid WGS 84 point.
 */
export function decodeWkbPoint(hex: string): GeoPoint | null {
  const bytes = hexToBytes(hex);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 5) throw new WkbError('too short');

  const order = bytes[0];
  if (order !== 0 && order !== 1) throw new WkbError('unknown byte order');
  const littleEndian = order === 1;

  const typeWord = view.getUint32(1, littleEndian);
  if (typeWord & (EWKB_Z | EWKB_M)) throw new WkbError('only 2D points are supported');
  const hasSrid = (typeWord & EWKB_SRID) !== 0;
  const geometryType = typeWord & 0x0fffffff;
  // ISO WKB encodes dimensions in the type number (1001 = Point Z, 2001 = Point M, …).
  if (geometryType !== WKB_POINT)
    throw new WkbError(`geometry type ${geometryType} is not a point`);

  const expectedLength = 1 + 4 + (hasSrid ? 4 : 0) + 16;
  if (bytes.length !== expectedLength) throw new WkbError('unexpected length');

  let offset = 5;
  if (hasSrid) {
    const srid = view.getUint32(offset, littleEndian);
    if (srid !== WGS84) throw new WkbError(`SRID ${srid} is not WGS 84 (4326)`);
    offset += 4;
  }
  const longitude = view.getFloat64(offset, littleEndian);
  const latitude = view.getFloat64(offset + 8, littleEndian);

  if (Number.isNaN(longitude) && Number.isNaN(latitude)) return null; // POINT EMPTY
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new WkbError('non-finite coordinates');
  }
  if (longitude < -180 || longitude > 180) throw new WkbError('longitude out of range');
  if (latitude < -90 || latitude > 90) throw new WkbError('latitude out of range');
  return { latitude, longitude };
}

/**
 * A location column from an API row: `null` when the value is NULL or an empty point, the
 * coordinates otherwise. A value that is present but not a valid WGS 84 point means the database
 * and this code have drifted: it is reported as a server error, never guessed.
 */
export function toGeoPoint(value: unknown): GeoPoint | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new ApiError('server', { debug: { message: 'Location is not a WKB hex string' } });
  }
  try {
    return decodeWkbPoint(value);
  } catch (error) {
    throw new ApiError('server', {
      debug: { message: error instanceof Error ? error.message : 'Invalid location' },
    });
  }
}
