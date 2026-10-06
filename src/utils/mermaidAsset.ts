import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

let cachedMermaidJs: string | null = null;
let loadPromise: Promise<string> | null = null;

/**
 * Loads and caches the bundled offline mermaid.min.js bundle.
 * The file is stored in assets/mermaid.min.js.txt to be bundled safely
 * without Metro treating it as application bundle code.
 */
export async function getMermaidJs(): Promise<string> {
  if (cachedMermaidJs) {
    return cachedMermaidJs;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const asset = Asset.fromModule(require('../../assets/mermaid.html'));
      await asset.downloadAsync();
      const localUri = asset.localUri || asset.uri;

      if (!localUri) {
        throw new Error('Local URI not found for Mermaid asset');
      }

      const content = await FileSystem.readAsStringAsync(localUri);
      if (!content || content.length < 1000) {
        throw new Error('Mermaid asset content is empty or invalid');
      }

      cachedMermaidJs = content;
      return content;
    } catch (err) {
      loadPromise = null;
      console.warn('[Mermaid] Failed to load bundled mermaid.js:', err);
      throw err;
    }
  })();

  return loadPromise;
}
