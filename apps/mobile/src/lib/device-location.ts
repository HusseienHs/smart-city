/**
 * The device's current position for a report. Coordinates stay on the device until the report
 * is sent to the municipality; no reverse geocoding or other external service is used.
 */
import * as Location from 'expo-location';

import type { DraftLocation } from './report-draft';

export type LocateResult =
  | { status: 'located'; location: DraftLocation }
  /** canAskAgain false: only the system Settings can allow it. */
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'services_off' }
  /** No fix in time (indoors, weak signal) or the position could not be read. */
  | { status: 'unavailable' };

export const LOCATE_TIMEOUT_MS = 20_000;
/** A recent last-known position is accepted when a fresh fix takes too long. */
const LAST_KNOWN_MAX_AGE_MS = 2 * 60_000;
const LAST_KNOWN_REQUIRED_ACCURACY_M = 200;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export function toDraftLocation(position: Location.LocationObject): DraftLocation {
  const { latitude, longitude, accuracy } = position.coords;
  return {
    latitude,
    longitude,
    ...(typeof accuracy === 'number' && accuracy >= 0 ? { accuracy: Math.round(accuracy) } : {}),
  };
}

export async function locateDevice(timeoutMs = LOCATE_TIMEOUT_MS): Promise<LocateResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };
    if (!(await Location.hasServicesEnabledAsync())) return { status: 'services_off' };
  } catch {
    return { status: 'unavailable' };
  }

  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeoutMs,
    );
    return { status: 'located', location: toDraftLocation(position) };
  } catch {
    try {
      const last = await Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_MAX_AGE_MS,
        requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY_M,
      });
      if (last) return { status: 'located', location: toDraftLocation(last) };
    } catch {
      // Reported as unavailable below.
    }
    return { status: 'unavailable' };
  }
}
