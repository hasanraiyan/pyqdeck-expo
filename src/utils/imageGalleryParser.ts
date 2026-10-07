export interface ImageItem {
  src: string;
  alt?: string;
}

/**
 * Regex for standard Markdown image tags: ![alt text](url)
 */
export const MARKDOWN_IMAGE_REGEX = /^!\[(.*?)\]\((.*?)\)$/;

/**
 * Global regex for matching markdown image tags anywhere in text
 */
export const GLOBAL_IMAGE_TAG_REGEX = /!\[(.*?)\]\((https?:\/\/[^\s\)]+|data:image\/[^\s\)]+|\/[^\s\)]+|\.{1,2}\/[^\s\)]+)\)/g;

/**
 * Checks if a block or string is exclusively a single Markdown image tag
 */
export function isPureImageTag(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return MARKDOWN_IMAGE_REGEX.test(trimmed);
}

/**
 * Parses a single Markdown image tag into an ImageItem
 */
export function parseImageTag(text: string): ImageItem | null {
  if (!text) return null;
  const trimmed = text.trim();
  const match = trimmed.match(MARKDOWN_IMAGE_REGEX);
  if (!match) return null;
  return {
    alt: match[1]?.trim() || undefined,
    src: match[2]?.trim() || '',
  };
}

/**
 * Scans content blocks and automatically merges consecutive `image` blocks
 * into a single unified `image_gallery` block.
 * Single images become an `image_gallery` of length 1 (for uniform lightbox & caption support).
 */
export function groupImageGalleries<T extends { type: string; [key: string]: any }>(blocks: T[]): T[] {
  if (!Array.isArray(blocks) || blocks.length === 0) return blocks;

  const result: T[] = [];
  let i = 0;

  while (i < blocks.length) {
    if (blocks[i].type === 'image') {
      let j = i;
      const images: ImageItem[] = [];

      while (j < blocks.length && blocks[j].type === 'image') {
        const item = blocks[j] as any;
        if (item.src) {
          images.push({
            src: item.src,
            alt: item.alt,
          });
        }
        j++;
      }

      if (images.length > 0) {
        result.push({
          type: 'image_gallery',
          images,
        } as unknown as T);
      }
      i = j;
    } else {
      result.push(blocks[i]);
      i++;
    }
  }

  return result;
}
