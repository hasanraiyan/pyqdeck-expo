import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { getBranches, getBranchSemesters } from '../api';
import { Branch } from '../types/syllabus';
import { ScreenError, ScreenEmpty } from '../components/ScreenState';
import { BranchListSkeleton } from '../components/Skeletons';

/**
 * The Syllabus tab opens here - "which branch" is the question that frames
 * everything below it, so it gets a page rather than a sheet.
 *
 * Tapping a branch opens its semesters, and nothing is remembered. An earlier
 * pass stored the choice and tagged that row "Yours", which read as a saved
 * profile the app does not have: there are no accounts, and nothing else keyed
 * off the value. The write existed only to feed the label describing it.
 */
export const BranchScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      setError(null);
      setBranches(await getBranches(force));
    } catch (e: any) {
      setError(e?.message || 'Could not load branches.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While the student is still reading this list, warm the semester screen for
  // every branch that actually has one. The first tap into a branch then renders
  // from cache instead of waiting on a round-trip - and this very first pass
  // also warms the server's own caches, so the cold start never lands on a tap.
  // Fire-and-forget: a slow branch must not block the list it is warming.
  useEffect(() => {
    if (!branches) return;
    for (const b of branches) {
      if (b.semesters && b.semesters.length > 0) {
        void getBranchSemesters(b.id).catch(() => {});
      }
    }
  }, [branches]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const open = (branchId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SemesterSelect', { branchId });
  };

  const header = (
    <>
      <View style={styles.head}>
        <Text style={styles.kicker}>PyQdeck · Syllabus</Text>
        <Text style={styles.title}>Choose your branch</Text>
        <Text style={styles.sub}>
          Pick a branch to see its semesters, subjects and topic-by-topic syllabus.
        </Text>
      </View>

      {branches && branches.length > 0 && (
        <View style={styles.rule}>
          <Text style={styles.ruleText}>Branches</Text>
          <View style={styles.ruleLine} />
          <Text style={styles.ruleText}>{branches.length}</Text>
        </View>
      )}
    </>
  );

  if (!branches) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {header}
        {error ? (
          <ScreenError message={error} onRetry={() => load(true)} />
        ) : (
          <BranchListSkeleton />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {header}

        {branches.length === 0 ? (
          <ScreenEmpty message="No branches have been added yet. Question papers are still available in the Browse tab." />
        ) : (
          branches.map((b) => {
            const sems = b.semesters?.length ?? 0;
            return (
              <TouchableOpacity
                key={b.id}
                style={styles.row}
                activeOpacity={0.6}
                onPress={() => open(b.id)}
              >
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{b.code}</Text>
                </View>

                <View style={styles.rowBody}>
                  <Text style={styles.name}>{b.name}</Text>
                  <Text style={styles.meta}>
                    {sems > 0
                      ? `${sems} semester${sems === 1 ? '' : 's'} ready · ${b.subjectCount ?? 0} subjects`
                      : 'Syllabus being typed up'}
                  </Text>
                </View>

                <Feather name="chevron-right" size={18} color={COLORS.textSubtle} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  head: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18 },
  kicker: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 25,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 31,
    letterSpacing: -0.5,
    marginTop: 10,
  },
  sub: { fontSize: 13.5, color: COLORS.textMuted, marginTop: 6, lineHeight: 19 },

  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  ruleText: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
  },
  ruleLine: { flex: 1, height: 1, backgroundColor: COLORS.borderDashed },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 68,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    // Rows stack, so each one's top border doubles with the row above it.
    marginBottom: -1,
  },
  codeBox: {
    width: 46,
    height: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.borderDashed,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.4,
  },
  rowBody: { flex: 1 },
  name: { fontSize: 14.5, lineHeight: 19, color: COLORS.text },
  meta: { fontFamily: FONTS.mono, fontSize: 10.5, color: COLORS.textSubtle, marginTop: 4 },
});
