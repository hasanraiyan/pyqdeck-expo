import * as ImagePicker from 'expo-image-picker';
import {
  recognizeText,
  TextRecognitionUnavailableError,
} from '../../modules/pyq-text-recognition';
import { toSearchQuery } from './searchGuard';

export type ScanSource = 'camera' | 'gallery';

export type ScanResult =
  | { status: 'ok'; text: string; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'error' };

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
    const result = await recognizeText(uri);
    const text = toSearchQuery(result?.text ?? '');
    return text.length > 0 ? { status: 'ok', text, uri } : { status: 'empty' };
  } catch (e) {
    if (e instanceof TextRecognitionUnavailableError) return { status: 'unavailable' };
    return { status: 'error' };
  }
}
