/**
 * Photos from the camera or the gallery, prepared for upload on the device:
 * - re-encoded as JPEG, which drops all metadata (EXIF: GPS position, device, time);
 * - the longest side reduced to PREPARED_PHOTO_MAX_SIDE, then compressed.
 * Nothing leaves the device here; uploading happens in report-submission.
 */
import { newReportPhotoId } from '@smart-city/api';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { base64ByteLength, base64ToBytes } from './base64';
import type { NewDraftPhoto } from './report-draft';

export const PREPARED_PHOTO_MAX_SIDE = 1600;
export const PREPARED_PHOTO_QUALITY = 0.7;

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

export type PickPhotosResult =
  | { status: 'picked'; images: PickedImage[] }
  | { status: 'cancelled' }
  /** canAskAgain false: only the system Settings can allow it. */
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable' };

/**
 * Opens the camera or the gallery. The gallery uses the system picker, which needs no
 * permission on Android and on supported iOS versions; the camera asks for permission first.
 * On the web both must run directly from a button press, so no permission step is awaited there.
 */
export async function pickPhotos(
  source: 'camera' | 'library',
  limit: number,
): Promise<PickPhotosResult> {
  if (limit < 1) return { status: 'cancelled' };
  try {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          return { status: 'denied', canAskAgain: permission.canAskAgain };
        }
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        exif: false,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: limit > 1,
        selectionLimit: limit,
        quality: 1,
        exif: false,
      });
    }
    if (result.canceled) return { status: 'cancelled' };
    return {
      status: 'picked',
      images: result.assets.map(({ uri, width, height }) => ({ uri, width, height })),
    };
  } catch {
    // E.g. no camera (emulator) or the picker could not open.
    return { status: 'unavailable' };
  }
}

/**
 * Android only: Android may destroy the app while the camera (or gallery) is open, e.g. on low
 * memory. The app then restarts and the photo would be lost; the picker keeps it as a pending
 * result, read here once after the restart. Returns [] when there is none (always on iOS/web).
 */
export async function takePendingPhotos(): Promise<PickedImage[]> {
  if (Platform.OS !== 'android') return [];
  try {
    const result = await ImagePicker.getPendingResultAsync();
    // null = nothing pending; an error result has no `canceled`; a cancelled pick has no assets.
    if (!result || !('canceled' in result) || result.canceled) return [];
    return result.assets
      .filter((asset) => asset.type === undefined || asset.type === null || asset.type === 'image')
      .map(({ uri, width, height }) => ({ uri, width, height }));
  } catch {
    return [];
  }
}

/** The resize that keeps the aspect ratio, or null when the image is small enough. */
export function resizeFor(
  width: number,
  height: number,
  maxSide = PREPARED_PHOTO_MAX_SIDE,
): { width: number } | { height: number } | null {
  if (!(width > 0 && height > 0) || Math.max(width, height) <= maxSide) return null;
  return width >= height ? { width: maxSide } : { height: maxSide };
}

async function encodeJpeg(uri: string, resize: { width: number } | { height: number } | null) {
  const context = ImageManipulator.manipulate(uri);
  try {
    if (resize) context.resize(resize);
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: PREPARED_PHOTO_QUALITY,
        base64: true,
      });
      if (!saved.base64) throw new Error('No image data');
      return { ...saved, base64: saved.base64 };
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/** Prepares a picked image for the report: JPEG, resized, without metadata, with a fixed id. */
export async function preparePhoto(image: PickedImage): Promise<NewDraftPhoto> {
  const saved = await encodeJpeg(image.uri, resizeFor(image.width, image.height));
  return {
    id: newReportPhotoId(),
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
    sizeBytes: base64ByteLength(saved.base64),
  };
}

const isJpeg = (bytes: Uint8Array) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;

/**
 * The prepared photo's bytes for upload. Reads the file directly when the platform's fetch
 * supports it; otherwise encodes it again (it is already small and metadata-free, so the
 * result is equivalent). Throws when the file is gone (e.g. the system cleared its cache).
 */
export async function readPhotoBytes(uri: string): Promise<Uint8Array> {
  try {
    const response = await fetch(uri);
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (isJpeg(bytes)) return bytes;
    }
  } catch {
    // Fall through to re-encoding.
  }
  const saved = await encodeJpeg(uri, null);
  const bytes = base64ToBytes(saved.base64);
  if (!isJpeg(bytes)) throw new Error('Not a JPEG image');
  return bytes;
}
