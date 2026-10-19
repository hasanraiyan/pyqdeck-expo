import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { LocalImage } from '@pyqdeck/community-sdk';

/** The server accepts JPEG, PNG and WebP up to 8 MB each; anything larger is shrunk first. */
const SERVER_MAX_BYTES = 8 * 1024 * 1024;
const SHRINK_ABOVE_BYTES = 6 * 1024 * 1024;
const MAX_EDGE = 2048;

const mimeFromUri = (uri: string): LocalImage['mimeType'] | null => {
  const clean = uri.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  return null;
};

async function sizeOf(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === 'number' ? info.size : 0;
}

/**
 * Turns a picked photo into something the server will take: a known format (HEIC and unknown types become JPEG) and a
 * size under the limit. The exact byte size is declared to the server up front, so it is measured here.
 */
export async function prepareImage(uri: string, name?: string): Promise<LocalImage> {
  let finalUri = uri;
  let mime = mimeFromUri(uri);
  let size = await sizeOf(uri);

  if (!mime || size === 0 || size > SHRINK_ABOVE_BYTES) {
    const ctx = ImageManipulator.manipulate(uri);
    const probe = await ctx.renderAsync();
    const resized = Math.max(probe.width, probe.height) > MAX_EDGE;
    const shrink = ImageManipulator.manipulate(uri);
    if (resized) shrink.resize(probe.width >= probe.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
    const out = await (await shrink.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    finalUri = out.uri;
    mime = 'image/jpeg';
    size = await sizeOf(finalUri);
  }

  if (size === 0) throw new Error('Could not read the image.');
  if (size > SERVER_MAX_BYTES) throw new Error('This image is too large. Try a smaller one.');
  return { uri: finalUri, mimeType: mime ?? 'image/jpeg', size, name: name ?? `photo-${Date.now()}.${mime === 'image/png' ? 'png' : 'jpg'}` };
}
