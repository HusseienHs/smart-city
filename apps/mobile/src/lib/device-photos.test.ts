import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  pickPhotos,
  preparePhoto,
  readPhotoBytes,
  resizeFor,
  takePendingPhotos,
} from './device-photos';

const picker = vi.hoisted(() => ({
  getPendingResultAsync: vi.fn(),
  requestCameraPermissionsAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}));
const manipulator = vi.hoisted(() => {
  const saveAsync = vi.fn();
  const resize = vi.fn();
  const image = { saveAsync, release: vi.fn() };
  const context = { resize, renderAsync: vi.fn(async () => image), release: vi.fn() };
  return { saveAsync, resize, context, manipulate: vi.fn(() => context) };
});
vi.mock('expo-image-picker', () => picker);
vi.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: manipulator.manipulate },
  SaveFormat: { JPEG: 'jpeg' },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

const JPEG_BASE64 = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 1, 2));

beforeEach(() => {
  vi.clearAllMocks();
  manipulator.saveAsync.mockResolvedValue({
    uri: 'file:///cache/prepared.jpg',
    width: 1600,
    height: 1200,
    base64: JPEG_BASE64,
  });
});

describe('pickPhotos', () => {
  it('asks for the camera permission first and reports a refusal', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await pickPhotos('camera', 5)).toEqual({ status: 'denied', canAskAgain: false });
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('never asks for metadata, and limits the gallery selection to the free slots', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'content://a', width: 4000, height: 3000, exif: null }],
    });
    expect(await pickPhotos('library', 2)).toEqual({
      status: 'picked',
      images: [{ uri: 'content://a', width: 4000, height: 3000 }],
    });
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ exif: false, selectionLimit: 2, allowsMultipleSelection: true }),
    );
  });

  it('handles cancel, a full report and a missing camera', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
    expect(await pickPhotos('library', 3)).toEqual({ status: 'cancelled' });
    expect(await pickPhotos('library', 0)).toEqual({ status: 'cancelled' });
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    picker.launchCameraAsync.mockRejectedValue(new Error('no camera'));
    expect(await pickPhotos('camera', 1)).toEqual({ status: 'unavailable' });
  });
});

describe('takePendingPhotos (Android restart while the camera was open)', () => {
  it('returns the pending images, ignoring videos', async () => {
    picker.getPendingResultAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///a.jpg', width: 4000, height: 3000, type: 'image' },
        { uri: 'file:///b.mp4', width: 1, height: 1, type: 'video' },
      ],
    });
    expect(await takePendingPhotos()).toEqual([
      { uri: 'file:///a.jpg', width: 4000, height: 3000 },
    ]);
  });

  it('returns nothing when there is no result, it was cancelled, it is an error, or it throws', async () => {
    for (const value of [null, { canceled: true, assets: null }, { code: 'E', message: 'x' }]) {
      picker.getPendingResultAsync.mockResolvedValueOnce(value);
      expect(await takePendingPhotos()).toEqual([]);
    }
    picker.getPendingResultAsync.mockRejectedValueOnce(new Error('x'));
    expect(await takePendingPhotos()).toEqual([]);
  });
});

describe('preparePhoto', () => {
  it('resizes the longest side and re-encodes as JPEG (which removes metadata)', async () => {
    const photo = await preparePhoto({ uri: 'content://a', width: 3000, height: 4000 });
    expect(manipulator.resize).toHaveBeenCalledWith({ height: 1600 });
    expect(manipulator.saveAsync).toHaveBeenCalledWith({
      format: 'jpeg',
      compress: 0.7,
      base64: true,
    });
    expect(photo).toMatchObject({ uri: 'file:///cache/prepared.jpg', sizeBytes: 6 });
    expect(photo.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(manipulator.context.release).toHaveBeenCalled();
  });

  it('gives every photo its own id', async () => {
    const a = await preparePhoto({ uri: 'x', width: 10, height: 10 });
    const b = await preparePhoto({ uri: 'x', width: 10, height: 10 });
    expect(a.id).not.toBe(b.id);
  });

  it('resizes only when needed', () => {
    expect(resizeFor(1600, 900)).toBeNull();
    expect(resizeFor(4000, 3000)).toEqual({ width: 1600 });
    expect(resizeFor(0, 0)).toBeNull();
  });
});

describe('readPhotoBytes', () => {
  it('re-encodes when the file cannot be fetched, and fails when the file is gone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unsupported')));
    expect(Array.from(await readPhotoBytes('file:///cache/prepared.jpg')).slice(0, 2)).toEqual([
      0xff, 0xd8,
    ]);
    manipulator.context.renderAsync.mockRejectedValueOnce(new Error('missing file'));
    await expect(readPhotoBytes('file:///cache/gone.jpg')).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});
