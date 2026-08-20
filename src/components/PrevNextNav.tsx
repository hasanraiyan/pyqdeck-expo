import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';

interface NavItem {
  label: string;
  sublabel: string;
  onPress: () => void;
}

interface PrevNextNavProps {
  prev?: NavItem | null;
  next?: NavItem | null;
}

export const PrevNextNav: React.FC<PrevNextNavProps> = ({ prev, next }) => {
  if (!prev && !next) return null;

  return (
    <View style={styles.container}>
      {prev ? (
        <TouchableOpacity
          style={[styles.button, styles.prevButton]}
          activeOpacity={0.7}
          onPress={prev.onPress}
        >
          <Feather name="arrow-left" size={14} color={COLORS.text} style={styles.arrow} />
          <View style={styles.textContainer}>
            <Text style={styles.sublabel}>{prev.sublabel}</Text>
            <Text style={styles.label} numberOfLines={1}>
              {prev.label}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

      {next ? (
        <TouchableOpacity
          style={[styles.button, styles.nextButton]}
          activeOpacity={0.7}
          onPress={next.onPress}
        >
          <View style={[styles.textContainer, { alignItems: 'flex-end' }]}>
            <Text style={styles.sublabel}>{next.sublabel}</Text>
            <Text style={styles.label} numberOfLines={1}>
              {next.label}
            </Text>
          </View>
          <Feather name="arrow-right" size={14} color={COLORS.text} style={styles.arrow} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  prevButton: {
    justifyContent: 'flex-start',
  },
  nextButton: {
    justifyContent: 'flex-end',
  },
  placeholder: {
    flex: 1,
  },
  arrow: {
    marginHorizontal: 3,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  sublabel: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    color: COLORS.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.text,
  },
});

