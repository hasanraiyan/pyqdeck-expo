import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { questionTopicsQuery } from '../api/queries';
import { COLORS, FONTS } from '../theme/colors';

/**
 * "Topics" row on a past-paper question: the syllabus topics an admin linked it
 * to. Tapping a chip opens that topic's study notes, so a student can go from a
 * question straight to what to read. Renders nothing when the question has no
 * topics (or the lookup fails) - it never shows an error.
 */
export const QuestionTopicChips = ({
  subjectId,
  questionId,
}: {
  subjectId: string;
  questionId: string;
}) => {
  const navigation = useNavigation<any>();
  const q = useQuery({ ...questionTopicsQuery(subjectId, questionId), enabled: !!subjectId && !!questionId });
  const topics = q.data?.topics ?? [];
  if (topics.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.label}>
        <Feather name="book-open" size={12} color={COLORS.secondary} />
        <Text style={styles.labelText}>Topics</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {topics.map((t) => (
          <TouchableOpacity
            key={`${t.syllabusSubject}:${t.topicId}`}
            style={styles.chip}
            activeOpacity={0.7}
            accessibilityLabel={`Open notes for ${t.title}`}
            onPress={() => {
              Haptics.selectionAsync();
              navigation.navigate('TopicNotes', {
                topicId: t.topicId,
                subjectId: t.syllabusSubject,
                subjectName: t.syllabusSubjectName,
                moduleId: t.moduleId,
                moduleName: t.moduleTitle,
              });
            }}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {t.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  labelText: { fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.secondary },
  row: { gap: 6, paddingRight: 8 },
  chip: {
    maxWidth: 230,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.secondaryLight,
  },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: COLORS.secondary },
});
