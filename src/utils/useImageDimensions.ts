import { useEffect, useState } from 'react';
import { Image } from 'expo-image';

export interface ImageDims {
  width: number;
  height: number;
}

export type ImageOrientation = 'landscape' | 'portrait' | 'square';

const dimsCache = new Map<string, ImageDims>();

/**
 * Measures a remote image's intrinsic dimensions via expo-image (SDK 57:
 * `Image.loadAsync` resolves an ImageRef carrying width/height). Results are
 * cached per URL so galleries with repeated figures measure only once.
 * `maxWidth/maxHeight` bounds memory — we only need the aspect ratio.
 */
export function useImageDimensions(src?: string | null): {
  dims: ImageDims | null;
  aspect: number | null;
  orientation: ImageOrientation | null;
} {
  const [dims, setDims] = useState<ImageDims | null>(() =>
    src ? dimsCache.get(src) ?? null : null
  );

  useEffect(() => {
    if (!src || !src.startsWith('http')) {
      setDims(null);
      return;
    }
    const cached = dimsCache.get(src);
    if (cached) {
      setDims(cached);
      return;
    }
    let cancelled = false;
    Image.loadAsync({ uri: src }, { maxWidth: 1600, maxHeight: 1600 })
      .then((ref) => {
        if (cancelled || !ref?.width || !ref?.height) return;
        const next = { width: ref.width, height: ref.height };
        dimsCache.set(src, next);
        setDims(next);
      })
      .catch(() => {
        // Dimension probing is best-effort; tiles fall back to fixed height.
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const aspect = dims && dims.height > 0 ? dims.width / dims.height : null;
  const orientation: ImageOrientation | null =
    aspect == null ? null : aspect > 1.15 ? 'landscape' : aspect < 0.87 ? 'portrait' : 'square';

  return { dims, aspect, orientation };
}
