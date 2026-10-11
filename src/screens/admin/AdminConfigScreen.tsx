import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import Constants from 'expo-constants';
import { adminGetConfig, adminPutConfig } from '../../api';
import { userMessage } from '../../utils/netError';
import { useAdminAccess } from '../../admin/useAdminAccess';
import {
  can,
  configChanges,
  configToDraft,
  configWarnings,
  validateConfig,
  type ConfigDraft,
} from '../../admin/adminLogic';
import { AdminScroll, Btn, Card, Chip, ErrorBox, Field, Hint, Loading, ToggleRow } from '../../admin/ui';

/**
 * Edit the remote app config. Anything that would block or silence students
 * (a minimum version, a kill switch) asks for confirmation first, and says so if
 * the minimum would lock out this very phone.
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
        {error ? <ErrorBox message={error} onRetry={() => void load()} /> : <Loading />}
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
      {!canEdit && <Hint>You can view the config but not change it.</Hint>}
      <Card title="App versions">
        <Hint>Installed on this phone: {installed}. Apps older than the minimum are blocked behind an "Update required" screen.</Hint>
        <Field label="Minimum version (e.g. 1.5.0, empty = none)" value={draft.minAppVersion} onChangeText={(v) => set('minAppVersion', v)} editable={canEdit} keyboardType="numbers-and-punctuation" />
        <Field label="Recommended version (one-time prompt)" value={draft.recommendedAppVersion} onChangeText={(v) => set('recommendedAppVersion', v)} editable={canEdit} keyboardType="numbers-and-punctuation" />
      </Card>

      <Card title="Banner on Home">
        <Field
          label={`Message (${draft.bannerMessage.length}/200, empty = no banner)`}
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
        <Field label="Banner id (change it to show it again to people who dismissed it)" value={draft.bannerId} onChangeText={(v) => set('bannerId', v)} editable={canEdit} maxLength={40} />
      </Card>

      <Card title="Kill switches">
        <ToggleRow label="Account sync" hint="Off: all account sync stops. Local data is untouched." value={draft.syncEnabled} onChange={(v) => canEdit && set('syncEnabled', v)} />
        <ToggleRow label="Settings & Jump Back In sync" hint="Off: only progress keeps syncing." value={draft.settingsSyncEnabled} onChange={(v) => canEdit && set('settingsSyncEnabled', v)} />
        <ToggleRow label="Background sync nudges" hint="Off: other devices sync only when opened." value={draft.nudgesEnabled} onChange={(v) => canEdit && set('nudgesEnabled', v)} />
      </Card>

      {problem && <Hint>{problem}</Hint>}
      {error && <ErrorBox message={error} />}
      {canEdit && (
        <>
          <Btn label="Save changes" disabled={!dirty || !!problem} busy={saving} onPress={save} />
          {dirty && <Btn label="Discard changes" kind="secondary" onPress={() => setDraft(saved)} />}
        </>
      )}
      <Hint>Apps pick up changes on their next launch or when brought to the foreground (within about 10 minutes).</Hint>
    </AdminScroll>
  );
};
