import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { MAX_LEN } from './searchGuard';

export type ScanSource = 'camera' | 'gallery';

export type ScanResult =
  | { status: 'ok'; text: string; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'empty' }
  | { status: 'error' };

// OCR text is multi-line and noisy. Flatten it to one line and cut it to the
// search limit on a word boundary so the cut never lands mid-word.
export function toSearchQuery(raw: string, maxLen = MAX_LEN): string {
  const flat = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s.,?()+\-*/=%^'"]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= maxLen) return flat;
  const cut = flat.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

// Pick or capture one image, let the user crop it with the system editor, and
// read the text on-device (ML Kit, no upload). The gallery path uses the system
// photo picker, which needs no storage/media permission.
export async function scanTextFromImage(source: ScanSource): Promise<ScanResult> {
  try {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true, // crop UI
      quality: 0.9,
    };
    let res: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return { status: 'denied' };
      res = await ImagePicker.launchCameraAsync(options);
    } else {
      res = await ImagePicker.launchImageLibraryAsync(options);
    }
    if (res.canceled || !res.assets?.[0]?.uri) return { status: 'cancelled' };

    const uri = res.assets[0].uri;
    const result = await TextRecognition.recognize(uri);
    const text = toSearchQuery(result?.text ?? '');
    return text.length > 0 ? { status: 'ok', text, uri } : { status: 'empty' };
  } catch {
    return { status: 'error' };
  }
}
