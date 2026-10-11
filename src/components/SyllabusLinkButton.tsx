import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { syllabusForPyqQuery } from '../api/queries';
import { getSelectedBranch } from '../utils/settings';
import { COLORS, FONTS } from '../theme/colors';

/**
 * The way back from the PYQ tab: opens this past-paper subject's syllabus and
 * notes. When a subject is mapped to several syllabus subjects (different
 * branches share it) the student's saved branch decides, and if that does not
 * settle it they are asked. Renders nothing when no syllabus is mapped, so a
 * subject that has not been connected yet looks exactly as before.
 */
export const SyllabusLinkButton = ({ subjectId }: { subjectId: string }) => {
  const navigation = useNavigation<any>();
  const q = useQuery({ ...syllabusForPyqQuery(subjectId), enabled: !!subjectId });
  const options = q.data?.syllabusSubjects ?? [];
  if (options.length === 0) return null;

  const open = (id: string, name: string) => {
    navigation.navigate('SubjectSyllabus', { subjectId: id, subjectName: name });
  };

  const onPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (options.length === 1) return open(options[0].id, options[0].name);
    const saved = await getSelectedBranch();
    const mine = options.filter((o) => o.branches.some((b) => b.id === saved));
    if (mine.length === 1) return open(mine[0].id, mine[0].name);
    Alert.alert(
      'Which branch?',
      'This subject is in more than one branch. Pick yours to see its syllabus and notes.',
      [
        ...options.map((o) => ({
          text: `${o.branches.map((b) => b.name).join(', ') || o.name}`,
          onPress: () => open(o.id, o.name),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  return (
    <TouchableOpacity style={styles.btn} activeOpacity={0.7} onPress={() => void onPress()}>
      <Feather name="book-open" size={15} color={COLORS.secondary} />
      <Text style={styles.text}>Syllabus & notes</Text>
      <Feather name="chevron-right" size={15} color={COLORS.secondary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: COLORS.secondaryLight,
  },
  text: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.secondary },
});
