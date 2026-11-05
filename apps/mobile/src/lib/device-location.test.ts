import { beforeEach, describe, expect, it, vi } from 'vitest';

import { locateDevice } from './device-location';

const location = vi.hoisted(() => ({
  requestForegroundPermissionsAsync: vi.fn(),
  hasServicesEnabledAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  getLastKnownPositionAsync: vi.fn(),
  Accuracy: { High: 4 },
}));
vi.mock('expo-location', () => location);

const position = (accuracy: number | null) => ({
  coords: { latitude: 32.0853, longitude: 34.7818, accuracy },
  timestamp: 0,
});

beforeEach(() => {
  vi.resetAllMocks();
  location.requestForegroundPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  location.hasServicesEnabledAsync.mockResolvedValue(true);
  location.getLastKnownPositionAsync.mockResolvedValue(null);
});

describe('locateDevice', () => {
  it('returns the GPS position with a rounded accuracy', async () => {
    location.getCurrentPositionAsync.mockResolvedValue(position(7.6));
    expect(await locateDevice()).toEqual({
      status: 'located',
      location: { latitude: 32.0853, longitude: 34.7818, accuracy: 8 },
    });
    expect(location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 4 });
  });

  it('omits an unknown accuracy', async () => {
    location.getCurrentPositionAsync.mockResolvedValue(position(null));
    const result = await locateDevice();
    expect(result.status === 'located' && result.location).toEqual({
      latitude: 32.0853,
      longitude: 34.7818,
    });
  });

  it('reports a denied permission and whether it can be asked again', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    expect(await locateDevice()).toEqual({ status: 'denied', canAskAgain: false });
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reports location services turned off', async () => {
    location.hasServicesEnabledAsync.mockResolvedValue(false);
    expect(await locateDevice()).toEqual({ status: 'services_off' });
  });

  it('falls back to a recent last-known position, else reports unavailable', async () => {
    location.getCurrentPositionAsync.mockImplementation(() => new Promise(() => {}));
    location.getLastKnownPositionAsync.mockResolvedValueOnce(position(30));
    expect(await locateDevice(5)).toMatchObject({ status: 'located' });

    location.getCurrentPositionAsync.mockRejectedValue(new Error('no fix'));
    expect(await locateDevice(5)).toEqual({ status: 'unavailable' });
  });
});
