import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getSubjects } from '../api';
import { SubjectSummary } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { SubjectCardSkeleton } from '../components/Skeleton';
import { Badge } from '../components/Badge';

export const SubjectListScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { semesterId, semesterNumber } = route.params || {};

  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await getSubjects(semesterId);
      setSubjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [semesterId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.badgeText}>SEMESTER {semesterNumber}</Text>
        <Text style={styles.title}>Subjects</Text>
        <Text style={styles.subtitle}>
          Select a subject to browse year-wise questions and practice by module.
        </Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={{ padding: 16 }}>
            {[1, 2, 3, 4].map((i) => (
              <SubjectCardSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlatList
            data={subjects}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadData();
                }}
                tintColor={COLORS.primary}
              />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('SubjectDetail', {
                    semesterId,
                    subjectId: item.id,
                    subjectName: item.name,
                    subjectCode: item.code,
                  })
                }
              >
                <View style={styles.cardLeft}>
                  <View style={styles.codeRow}>
                    {item.code ? (
                      <Badge label={item.code} variant="secondary" />
                    ) : null}
                  </View>
                  <Text style={styles.subjectName}>{item.name}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.questionCountText}>
                    {item.questionCount}q
                  </Text>
                  <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
    backgroundColor: COLORS.card,
  },
  badgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 27,
    fontStyle: 'italic',
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  codeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  subjectName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 19,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionCountText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
