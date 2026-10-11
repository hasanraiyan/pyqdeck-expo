import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { adminGetConfig, adminPutConfig } from '../../api';
import { userMessage } from '../../utils/netError';
import { COLORS, FONTS } from '../../theme/colors';
import { useAdminAccess } from '../../admin/useAdminAccess';
import {
  can,
  configChanges,
  configToDraft,
  configWarnings,
  validateConfig,
  type ConfigDraft,
} from '../../admin/adminLogic';
import {
  ActionBar,
  AdminScroll,
  BannerPreview,
  Btn,
  Card,
  Chip,
  ErrorBox,
  Field,
  Hint,
  Loading,
  Notice,
  PageHeader,
  Pill,
  Section,
  ToggleRow,
} from '../../admin/ui';

/**
 * The live app settings. Each group explains what it does in plain words, the
 * banner shows a preview, and anything that would block or silence students asks
 * for confirmation before it is saved. Changes wait in an action bar until saved.
 */
export const AdminConfigScreen = () => {
  const { tools } = useAdminAccess();
  const canEdit = can(tools, 'manage_app_config', 'update');
  const [saved, setSaved] = useState<ConfigDraft | null>(null);
  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const installed = Constants.expoConfig?.version ?? '0.0.0';

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = configToDraft(await adminGetConfig());
      setSaved(d);
      setDraft(d);
    } catch (e) {
      setError(userMessage(e, 'Could not load the config.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!draft || !saved) {
    return (
      <AdminScroll>
        <PageHeader title="App config" />
        <Section>{error ? <ErrorBox message={error} onRetry={() => void load()} /> : <Loading label="Loading settings" />}</Section>
      </AdminScroll>
    );
  }

  const set = <K extends keyof ConfigDraft>(k: K, v: ConfigDraft[K]) => setDraft({ ...draft, [k]: v });
  const problem = validateConfig(draft);
  const changes = configChanges(saved, draft);
  const dirty = Object.keys(changes).length > 0;

  const save = () => {
    const warnings = configWarnings(saved, draft, installed);
    const go = async () => {
      setSaving(true);
      setError(null);
      try {
        const next = configToDraft(await adminPutConfig(changes));
        setSaved(next);
        setDraft(next);
      } catch (e) {
        setError(userMessage(e, 'Could not save.'));
      } finally {
        setSaving(false);
      }
    };
    if (warnings.length === 0) return void go();
    Alert.alert('This affects students', warnings.join('\n\n'), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save anyway', style: 'destructive', onPress: () => void go() },
    ]);
  };

  return (
    <AdminScroll>
      <PageHeader
        title="App config"
        summary="Changes reach phones on their next launch or when the app comes to the foreground, within about 10 minutes."
      />

      {!canEdit && (
        <Section>
          <Notice tone="info">You can view these settings but not change them.</Notice>
        </Section>
      )}
      {error && (
        <Section>
          <ErrorBox message={error} />
        </Section>
      )}

      <Section title="Versions">
        <Card>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted }}>
            This phone runs {installed}. Apps below the minimum are stopped at an "Update required" screen.
          </Text>
          <Field
            label="Minimum version"
            hint="Leave empty for no minimum."
            value={draft.minAppVersion}
            onChangeText={(v) => set('minAppVersion', v)}
            editable={canEdit}
            keyboardType="numbers-and-punctuation"
            placeholder="e.g. 1.5.0"
          />
          <Field
            label="Recommended version"
            hint={'Shows a one-time "Update available" prompt. Nothing is blocked.'}
            value={draft.recommendedAppVersion}
            onChangeText={(v) => set('recommendedAppVersion', v)}
            editable={canEdit}
            keyboardType="numbers-and-punctuation"
            placeholder="e.g. 1.6.0"
          />
        </Card>
      </Section>

      <Section title="Home banner">
        <Card>
          <Field
            label={`Message · ${draft.bannerMessage.length}/200`}
            hint="Empty hides the banner."
            value={draft.bannerMessage}
            onChangeText={(v) => set('bannerMessage', v)}
            editable={canEdit}
            multiline
            maxLength={200}
            autoCapitalize="sentences"
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Info" active={draft.bannerLevel === 'info'} onPress={() => canEdit && set('bannerLevel', 'info')} />
            <Chip label="Warning" active={draft.bannerLevel === 'warning'} onPress={() => canEdit && set('bannerLevel', 'warning')} />
          </View>
          <Field
            label="Banner id"
            hint="Students who dismissed the banner see it again only when this changes. Use a new id for a new announcement, but keep it the same to fix a typo."
            value={draft.bannerId}
            onChangeText={(v) => set('bannerId', v)}
            editable={canEdit}
            maxLength={40}
          />
          <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.textMuted }}>Preview</Text>
          <BannerPreview message={draft.bannerMessage} level={draft.bannerLevel} />
        </Card>
      </Section>

      <Section title="Sync switches">
        <Card>
          <ToggleRow
            label="Account sync"
            hint="Off stops all progress sync everywhere. Nothing on the phones is deleted."
            value={draft.syncEnabled}
            disabled={!canEdit}
            onChange={(v) => set('syncEnabled', v)}
          />
          <ToggleRow
            label="Settings and Jump Back In sync"
            hint="Off keeps progress syncing but stops the settings and recent items."
            value={draft.settingsSyncEnabled}
            disabled={!canEdit}
            onChange={(v) => set('settingsSyncEnabled', v)}
          />
          <ToggleRow
            label="Background sync nudges"
            hint="Off means another phone updates only when the app is opened."
            value={draft.nudgesEnabled}
            disabled={!canEdit}
            onChange={(v) => set('nudgesEnabled', v)}
          />
          <ToggleRow
            label="Paid ads"
            hint="Off hides AdMob banners and interstitials for everyone, including signed-out devices."
            value={draft.adsEnabled}
            disabled={!canEdit}
            onChange={(v) => set('adsEnabled', v)}
          />
          {!draft.syncEnabled && <Pill label="Sync is paused for everyone" tone="danger" icon="pause-circle" />}
          {!draft.adsEnabled && <Pill label="Ads are hidden for everyone" tone="warn" icon="eye-off" />}
        </Card>
      </Section>

      {problem && (
        <Section>
          <Notice tone="warn">{problem}</Notice>
        </Section>
      )}

      <View style={{ height: dirty ? 80 : 0 }} />
      {dirty && canEdit && (
        <ActionBar dirtyLabel="Unsaved changes">
          <Btn label="Discard" kind="ghost" onPress={() => setDraft(saved)} />
          <Btn label="Save" disabled={!!problem} busy={saving} onPress={save} />
        </ActionBar>
      )}
    </AdminScroll>
  );
};
