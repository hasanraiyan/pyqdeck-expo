import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { adminNotify } from '../../api';
import { userMessage } from '../../utils/netError';
import {
  canSend,
  notifyFingerprint,
  parseEmails,
  validateNotify,
  type NotifyInput,
} from '../../admin/adminLogic';
import {
  AdminScroll,
  Btn,
  Card,
  Chip,
  Field,
  Fact,
  Hint,
  Notice,
  PageHeader,
  Pill,
  Section,
  StatTile,
  TileGrid,
} from '../../admin/ui';

const AUDIENCES: { id: NotifyInput['audience']; label: string; hint: string }[] = [
  { id: 'all', label: 'Everyone', hint: 'Every phone with the app' },
  { id: 'signed_in', label: 'Signed in', hint: 'Phones linked to an account' },
  { id: 'signed_out', label: 'Signed out', hint: 'Phones with no account' },
  { id: 'beta', label: 'Beta testers', hint: 'Accounts marked beta' },
];

interface Preview {
  fingerprint: string;
  recipients: number;
  unmatchedEmails: string[];
  usersWithoutDevice?: number;
}

/**
 * Three steps: write it, choose who gets it, preview the count. Send stays off
 * until the preview matches what is on screen, and it confirms before sending.
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
  const audienceLabel = named
    ? `${parsed.emails.length} named account${parsed.emails.length === 1 ? '' : 's'}`
    : (AUDIENCES.find((a) => a.id === audience)?.label ?? audience);

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
    Alert.alert(
      'Send this notification?',
      `"${title.trim()}"\n\nTo: ${audienceLabel}\nPhones reached: ${preview.recipients}\n\nIt cannot be unsent.`,
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
              setResult(`Sent to ${res.sent ?? 0} phone(s). Failed: ${res.failed ?? 0}. Removed dead devices: ${res.pruned ?? 0}.`);
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
      <PageHeader title="Send notification" summary="A push to phones. Preview the count before you send." />

      {result && (
        <Section>
          <Notice tone="info" title="Sent">
            {result}
          </Notice>
        </Section>
      )}

      <Section title="1 · Write">
        <Card>
          <Field label={`Title · ${title.length}/80`} value={title} onChangeText={setTitle} maxLength={80} autoCapitalize="sentences" />
          <Field label={`Message · ${body.length}/180`} value={body} onChangeText={setBody} maxLength={180} multiline autoCapitalize="sentences" />
        </Card>
      </Section>

      <Section title="2 · Who gets it">
        <TileGrid>
          {AUDIENCES.map((a) => (
            <View key={a.id} style={{ flexBasis: '47%', flexGrow: 1, opacity: named ? 0.45 : 1 }}>
              <Chip label={a.label} active={!named && audience === a.id} onPress={() => setAudience(a.id)} />
              <Hint>{a.hint}</Hint>
            </View>
          ))}
        </TileGrid>
        <Card>
          <Field
            label="Or only these accounts"
            hint="Emails, separated by commas or new lines. Naming accounts replaces the group above. They receive it only on phones where they are signed in."
            value={emailText}
            onChangeText={setEmailText}
            multiline
            placeholder="asha@example.com, ravi@example.com"
          />
          {parsed.invalid.length > 0 && (
            <Notice tone="warn">Not an email, ignored: {parsed.invalid.join(', ')}</Notice>
          )}
        </Card>
      </Section>

      <Section title="3 · Preview and send">
        {problem && (title || body) ? <Notice tone="warn">{problem}</Notice> : null}

        <Btn
          label="Preview recipients"
          kind="secondary"
          icon="users"
          disabled={!!problem}
          busy={busy === 'preview'}
          onPress={() => void runPreview()}
        />

        {preview && (
          <Card>
            <TileGrid>
              <StatTile label="Phones reached" value={preview.recipients} tone={preview.recipients === 0 ? 'danger' : 'neutral'} />
              {named && <StatTile label="Accounts with no phone" value={preview.usersWithoutDevice ?? 0} />}
            </TileGrid>
            <Fact label="Audience" value={audienceLabel} />
            {preview.unmatchedEmails.length > 0 && (
              <Notice tone="warn">No account for: {preview.unmatchedEmails.join(', ')}</Notice>
            )}
            {!sendable ? (
              <Pill label="Changed since preview: preview again" tone="warn" icon="refresh-cw" />
            ) : (
              <Pill label="Ready to send" tone="ok" icon="check" />
            )}
          </Card>
        )}

        <Btn
          label={preview && preview.recipients === 0 ? 'Nobody would receive this' : 'Send notification'}
          icon="send"
          disabled={!sendable || (preview?.recipients ?? 0) === 0}
          busy={busy === 'send'}
          onPress={send}
        />
      </Section>

      {error && (
        <Section>
          <Notice tone="danger">{error}</Notice>
        </Section>
      )}
    </AdminScroll>
  );
};
