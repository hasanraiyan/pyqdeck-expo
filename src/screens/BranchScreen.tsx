import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { BRANCHES, availableSemesters } from '../data/syllabus';

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

  const open = (branchId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SemesterSelect', { branchId });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <View style={styles.head}>
          <Text style={styles.kicker}>PyQdeck · Syllabus</Text>
          <Text style={styles.title}>Choose your branch</Text>
          <Text style={styles.sub}>
            Pick a branch to see its semesters, subjects and topic-by-topic syllabus.
          </Text>
        </View>

        <View style={styles.rule}>
          <Text style={styles.ruleText}>Branches</Text>
          <View style={styles.ruleLine} />
          <Text style={styles.ruleText}>{BRANCHES.length}</Text>
        </View>

        {BRANCHES.map((b) => {
          const sems = availableSemesters(b.id).length;
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
                    ? `${sems} semester${sems === 1 ? '' : 's'} ready · ${b.subjectCount} subjects`
                    : `${b.subjectCount} subjects · syllabus being typed up`}
                </Text>
              </View>

              <Feather name="chevron-right" size={18} color={COLORS.textSubtle} />
            </TouchableOpacity>
          );
        })}
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

  // A ruled heading rather than a filled bar - the sheet this borrows from has
  // rules, not blocks.
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
