import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { adminNotify } from '../../api';
import { userMessage } from '../../utils/netError';
import {
  canSend,
  notifyFingerprint,
  parseEmails,
  validateNotify,
  type NotifyInput,
} from '../../admin/adminLogic';
import { AdminScroll, Btn, Card, Chip, ErrorBox, Field, Hint, Line } from '../../admin/ui';

const AUDIENCES: { id: NotifyInput['audience']; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'signed_in', label: 'Signed in' },
  { id: 'signed_out', label: 'Signed out' },
  { id: 'beta', label: 'Beta' },
];

interface Preview {
  fingerprint: string;
  recipients: number;
  unmatchedEmails: string[];
  usersWithoutDevice?: number;
}

/**
 * Send is possible only for exactly what was previewed: any edit after a preview
 * disables it until previewing again, and sending asks to confirm the audience
 * and the count it showed.
 */
export const AdminNotifyScreen = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<NotifyInput['audience']>('all');
  const [emailText, setEmailText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const parsed = useMemo(() => parseEmails(emailText), [emailText]);
  const input: NotifyInput = { title, body, audience, emails: parsed.emails };
  const problem = validateNotify(input);
  const sendable = canSend(input, preview?.fingerprint ?? null);
  const named = parsed.emails.length > 0;

  const request = (dryRun: boolean) => ({
    title: title.trim(),
    body: body.trim(),
    dryRun,
    ...(named ? { emails: parsed.emails } : { audience }),
  });

  const runPreview = async () => {
    setError(null);
    setResult(null);
    setBusy('preview');
    try {
      const res = await adminNotify(request(true));
      setPreview({
        fingerprint: notifyFingerprint(input),
        recipients: res.recipients ?? 0,
        unmatchedEmails: res.unmatchedEmails ?? [],
        usersWithoutDevice: res.usersWithoutDevice,
      });
    } catch (e) {
      setPreview(null);
      setError(userMessage(e, 'Could not preview.'));
    } finally {
      setBusy(null);
    }
  };

  const send = () => {
    if (!preview) return;
    const who = named
      ? `${parsed.emails.length} named account(s)`
      : (AUDIENCES.find((a) => a.id === audience)?.label ?? audience);
    Alert.alert(
      'Send notification?',
      `"${title.trim()}"\n\nTo: ${who}\nDevices reached: ${preview.recipients}\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'destructive',
          onPress: async () => {
            setBusy('send');
            setError(null);
            try {
              const res = await adminNotify(request(false));
              setResult(`Sent ${res.sent ?? 0}, failed ${res.failed ?? 0}, removed ${res.pruned ?? 0} dead device(s).`);
              setPreview(null);
              setTitle('');
              setBody('');
              setEmailText('');
            } catch (e) {
              setError(userMessage(e, 'Could not send.'));
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  return (
    <AdminScroll>
      <Card title="Message">
        <Field label={`Title (${title.length}/80)`} value={title} onChangeText={setTitle} maxLength={80} autoCapitalize="sentences" />
        <Field
          label={`Message (${body.length}/180)`}
          value={body}
          onChangeText={setBody}
          maxLength={180}
          multiline
          autoCapitalize="sentences"
        />
      </Card>

      <Card title="Who gets it">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, opacity: named ? 0.4 : 1 }}>
          {AUDIENCES.map((a) => (
            <Chip key={a.id} label={a.label} active={!named && audience === a.id} onPress={() => setAudience(a.id)} />
          ))}
        </View>
        <Field
          label="Or only these accounts (emails, comma or line separated)"
          value={emailText}
          onChangeText={setEmailText}
          multiline
          placeholder="asha@example.com, ravi@example.com"
        />
        {named && <Hint>Naming accounts overrides the group above. They only receive it on phones where they are signed in.</Hint>}
        {parsed.invalid.length > 0 && <Hint>Ignored (not an email): {parsed.invalid.join(', ')}</Hint>}
      </Card>

      {problem && (title || body) ? <Hint>{problem}</Hint> : null}

      <Btn label="Preview recipients" kind="secondary" disabled={!!problem} busy={busy === 'preview'} onPress={() => void runPreview()} />

      {preview && (
        <Card title="Preview">
          <Line label="Devices reached" value={preview.recipients} />
          {named && <Line label="Accounts with no device" value={preview.usersWithoutDevice ?? 0} />}
          {preview.unmatchedEmails.length > 0 && (
            <Text style={{ color: '#b91c1c', fontSize: 12 }}>No account for: {preview.unmatchedEmails.join(', ')}</Text>
          )}
          {!sendable && <Hint>You changed something after previewing. Preview again to send.</Hint>}
        </Card>
      )}

      <Btn label="Send" disabled={!sendable || (preview?.recipients ?? 0) === 0} busy={busy === 'send'} onPress={send} />
      {preview && preview.recipients === 0 && <Hint>Nobody would receive this, so Send is off.</Hint>}

      {error && <ErrorBox message={error} />}
      {result && <Card title="Done"><Text>{result}</Text></Card>}
    </AdminScroll>
  );
};
