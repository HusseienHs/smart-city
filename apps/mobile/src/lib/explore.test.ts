import { describe, expect, it } from 'vitest';

import {
  areaAround,
  areaChanged,
  areaToRegion,
  displayDistance,
  distanceKm,
  MAX_AREA_SPAN,
  regionToArea,
  sortByDistance,
} from './explore';

const telAviv = { latitude: 32.0853, longitude: 34.7818 };
const jerusalem = { latitude: 31.7683, longitude: 35.2137 };

describe('areas', () => {
  it('builds a square around a point, within the database limit', () => {
    const area = areaAround(telAviv, 3);
    expect(area.north).toBeGreaterThan(area.south);
    expect(area.east).toBeGreaterThan(area.west);
    expect(area.north - area.south).toBeCloseTo(6 / 111.32, 3);
    // Longitude degrees are shorter away from the equator: a wider span for the same distance.
    expect(area.east - area.west).toBeGreaterThan(area.north - area.south);
    expect((area.north + area.south) / 2).toBeCloseTo(telAviv.latitude, 4);
  });

  it('never exceeds the allowed span, even for huge radii or zoomed-out maps', () => {
    const wide = areaAround(telAviv, 500);
    expect(wide.north - wide.south).toBeLessThanOrEqual(MAX_AREA_SPAN + 1e-9);
    expect(wide.east - wide.west).toBeLessThanOrEqual(MAX_AREA_SPAN + 1e-9);
    const region = regionToArea({ ...telAviv, latitudeDelta: 4, longitudeDelta: 6 });
    expect(region.north - region.south).toBeLessThanOrEqual(MAX_AREA_SPAN + 1e-9);
    expect(region.east - region.west).toBeLessThanOrEqual(MAX_AREA_SPAN + 1e-9);
  });

  it('round-trips between areas and regions', () => {
    const area = areaAround(jerusalem, 2);
    const back = regionToArea(areaToRegion(area));
    expect(back.south).toBeCloseTo(area.south, 5);
    expect(back.east).toBeCloseTo(area.east, 5);
  });

  it('detects meaningful map moves only', () => {
    const area = areaAround(telAviv, 3);
    expect(areaChanged(area, { ...area })).toBe(false);
    expect(
      areaChanged(area, { ...area, south: area.south + 0.001, north: area.north + 0.001 }),
    ).toBe(false);
    expect(areaChanged(area, areaAround(jerusalem, 3))).toBe(true);
  });
});

describe('distances', () => {
  it('measures great-circle distance', () => {
    expect(distanceKm(telAviv, jerusalem)).toBeGreaterThan(50);
    expect(distanceKm(telAviv, jerusalem)).toBeLessThan(60);
    expect(distanceKm(telAviv, telAviv)).toBe(0);
  });

  it('displays meters under a kilometer and kilometers above', () => {
    expect(displayDistance(0.012)).toEqual({ unit: 'm', value: '50' });
    expect(displayDistance(0.349)).toEqual({ unit: 'm', value: '350' });
    expect(displayDistance(2.345)).toEqual({ unit: 'km', value: '2.3' });
    expect(displayDistance(23.6)).toEqual({ unit: 'km', value: '24' });
  });

  it('sorts nearest first, or keeps the order without an origin', () => {
    const items = [
      { id: 'far', ...jerusalem },
      { id: 'near', latitude: 32.08, longitude: 34.78 },
    ];
    expect(sortByDistance(items, telAviv).map((i) => i.id)).toEqual(['near', 'far']);
    expect(sortByDistance(items, null).map((i) => i.id)).toEqual(['far', 'near']);
  });
});
