import { Alert } from 'react-native';
import type { ReportReason } from '@pyqdeck/community-sdk';
import { reportContent } from './actions';

type Target = 'post' | 'comment' | 'member';

const LABEL: Record<Target, string> = { post: 'post', comment: 'comment', member: 'student' };

/**
 * Asks why, then sends the report. Alert shows at most three buttons on Android, so the reasons are grouped;
 * tapping outside the dialog cancels.
 */
export function promptReport(target: Target, targetId: string): void {
  const send = async (reason: ReportReason) => {
    if (await reportContent(target, targetId, reason)) {
      Alert.alert('Report received', 'Thank you for keeping the community safe. Our team will review this.');
    }
  };
  Alert.alert(
    `Report this ${LABEL[target]}`,
    'What is wrong with it?',
    [
      { text: 'Spam or misleading', onPress: () => void send('spam') },
      { text: 'Abusive or hateful', onPress: () => void send('harassment') },
      { text: 'Something else', onPress: () => void send('other') },
    ],
    { cancelable: true },
  );
}
