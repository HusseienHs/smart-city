import { describe, expect, it } from 'vitest';

import { ApiError } from '../errors/api-error';
import { decodeWkbPoint, toGeoPoint, WkbError } from './geo';

/*
 * Fixtures produced by PostGIS 3.6 (the PGlite build used by supabase/tests), not hand-made:
 *   select st_setsrid(st_makepoint(lon, lat), 4326)::geography::text
 * `json_build_object` / `row_to_json` of a geography column yield exactly the same string,
 * which is what PostgREST returns to the API.
 */
const FIXTURES = {
  /** POINT(34.7512345 32.0712345), SRID 4326 — EWKB, little-endian, as returned by the API. */
  telAviv: '0101000020E61000003F90BC732860414068EC4B361E094040',
  /** POINT(35.2137 31.7683), SRID 4326. */
  jerusalem: '0101000020E6100000DE9387855A9B41404D840D4FAFC43F40',
  /** POINT(-180 -90): the extreme valid corner. */
  corner: '0101000020E610000000000000008066C000000000008056C0',
  /** The Tel Aviv point as big-endian (XDR) EWKB: st_asewkb(…, 'XDR'). */
  telAvivXdr: '0020000001000010e64041602873bc903f4040091e364bec68',
  /** The Tel Aviv point as plain OGC WKB without SRID: st_asbinary(…). */
  telAvivNoSrid: '01010000003f90bc732860414068ec4b361e094040',
  /** POINT Z(34.75 32.07 10), SRID 4326. */
  pointZ: '01010000A0E61000000000000000604140295C8FC2F50840400000000000002440',
  /** LINESTRING(1 2, 3 4), SRID 4326. */
  lineString:
    '0102000020E610000002000000000000000000F03F000000000000004000000000000008400000000000001040',
  /** POINT EMPTY, SRID 4326 (NaN coordinates). */
  empty: '0101000020E6100000000000000000F87F000000000000F87F',
  /** POINT(200000 600000) in the Israeli grid, SRID 2039. */
  israeliGrid: '0101000020F707000000000000006A084100000000804F2241',
} as const;

describe('decodeWkbPoint', () => {
  it('decodes the EWKB the API returns: X is longitude, Y is latitude', () => {
    expect(decodeWkbPoint(FIXTURES.telAviv)).toEqual({
      latitude: 32.0712345,
      longitude: 34.7512345,
    });
    expect(decodeWkbPoint(FIXTURES.jerusalem)).toEqual({ latitude: 31.7683, longitude: 35.2137 });
  });

  it('never swaps latitude and longitude', () => {
    const point = decodeWkbPoint(FIXTURES.jerusalem)!;
    // Israel: latitude ≈ 29–33.5, longitude ≈ 34–36.
    expect(point.latitude).toBeGreaterThan(29);
    expect(point.latitude).toBeLessThan(34);
    expect(point.longitude).toBeGreaterThan(34);
  });

  it('accepts big-endian and SRID-less encodings of the same point', () => {
    const expected = { latitude: 32.0712345, longitude: 34.7512345 };
    expect(decodeWkbPoint(FIXTURES.telAvivXdr)).toEqual(expected);
    expect(decodeWkbPoint(FIXTURES.telAvivNoSrid)).toEqual(expected);
  });

  it('accepts the extreme valid coordinates', () => {
    expect(decodeWkbPoint(FIXTURES.corner)).toEqual({ latitude: -90, longitude: -180 });
  });

  it('returns null for an empty point', () => {
    expect(decodeWkbPoint(FIXTURES.empty)).toBeNull();
  });

  it('rejects anything that is not a 2D WGS 84 point', () => {
    expect(() => decodeWkbPoint(FIXTURES.pointZ)).toThrow(/2D/);
    expect(() => decodeWkbPoint(FIXTURES.lineString)).toThrow(/not a point/);
    expect(() => decodeWkbPoint(FIXTURES.israeliGrid)).toThrow(/SRID 2039/);
  });

  it('rejects malformed input', () => {
    for (const bad of [
      '',
      'xyz',
      '010',
      '0101000020E6100000',
      `${FIXTURES.telAviv}00`,
      '02' + FIXTURES.telAviv.slice(2),
    ]) {
      expect(() => decodeWkbPoint(bad)).toThrow(WkbError);
    }
  });

  it('rejects out-of-range and non-finite coordinates', () => {
    const point = (x: number, y: number) => {
      const bytes = new DataView(new ArrayBuffer(25));
      bytes.setUint8(0, 1);
      bytes.setUint32(1, 0x20000001, true);
      bytes.setUint32(5, 4326, true);
      bytes.setFloat64(9, x, true);
      bytes.setFloat64(17, y, true);
      return [...new Uint8Array(bytes.buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
    };
    // The helper reproduces the real fixture exactly, so the cases below are realistic.
    expect(point(34.7512345, 32.0712345).toUpperCase()).toBe(FIXTURES.telAviv);
    expect(() => decodeWkbPoint(point(181, 32))).toThrow(/longitude/);
    expect(() => decodeWkbPoint(point(34, 91))).toThrow(/latitude/);
    // Swapped coordinates of a point near the pole would put latitude out of range.
    expect(() => decodeWkbPoint(point(10, 120))).toThrow(/latitude/);
    expect(() => decodeWkbPoint(point(Infinity, 32))).toThrow(/non-finite/);
    expect(() => decodeWkbPoint(point(Number.NaN, 32))).toThrow(/non-finite/);
  });
});

describe('toGeoPoint', () => {
  it('maps NULL to null and valid values to coordinates', () => {
    expect(toGeoPoint(null)).toBeNull();
    expect(toGeoPoint(undefined)).toBeNull();
    expect(toGeoPoint(FIXTURES.telAviv)).toEqual({ latitude: 32.0712345, longitude: 34.7512345 });
  });

  it('reports drift (a non-string or an invalid point) as a server error', () => {
    for (const bad of [{ type: 'Point', coordinates: [34, 32] }, 42, FIXTURES.lineString]) {
      const error = (() => {
        try {
          toGeoPoint(bad);
        } catch (caught) {
          return caught;
        }
        return null;
      })();
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('server');
    }
  });
});
