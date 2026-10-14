import { requireOptionalNativeModule } from 'expo-modules-core';

// Android-only native module (unbundled ML Kit). On other platforms it is absent.
const Native = requireOptionalNativeModule<{
  recognize(uri: string): Promise<{ text: string }>;
}>('PyqTextRecognition');

export const isTextRecognitionAvailable = Native != null;

export class TextRecognitionUnavailableError extends Error {
  constructor() {
    super('The on-device text model is not available yet.');
    this.name = 'TextRecognitionUnavailableError';
  }
}

// Read the text in the image at `uri`. Throws TextRecognitionUnavailableError when
// the model has not been downloaded by Google Play Services yet (needs internet once).
export async function recognizeText(uri: string): Promise<{ text: string }> {
  if (!Native) throw new TextRecognitionUnavailableError();
  try {
    return await Native.recognize(uri);
  } catch (e) {
    if ((e as { code?: string } | null)?.code === 'ERR_OCR_UNAVAILABLE') {
      throw new TextRecognitionUnavailableError();
    }
    throw e;
  }
}
