import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { DiagramPlaceholder } from '../components/DiagramPlaceholder';
import { COLORS, FONTS, RADIUS } from '../theme/colors';

// Debug page (Settings > DEBUG) for comparing diagram loading animations.
const SURFACES = [
  { id: 'white', label: 'White (notes SVG)', color: '#FFFFFF' },
  { id: 'paper', label: 'Paper (flowchart)', color: COLORS.background },
];

const PlaceholderCard: React.FC<{ bg: string }> = ({ bg }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);

  const toggleReveal = () => {
    const next = !revealed;
    setRevealed(next);
    Animated.timing(fade, {
      toValue: next ? 1 : 0,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.card}>
      <View style={[styles.canvas, { backgroundColor: bg }]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.fakeDiagram, { opacity: fade }]}>
          <Text style={styles.fakeDiagramText}>DIAGRAM LOADED</Text>
        </Animated.View>
        <DiagramPlaceholder bg={bg} fade={fade} />
      </View>
      <TouchableOpacity onPress={toggleReveal} style={styles.button} activeOpacity={0.8}>
        <Text style={styles.buttonText}>{revealed ? 'Show placeholder again' : 'Preview reveal'}</Text>
      </TouchableOpacity>
    </View>
  );
};

export const PlaceholderLabScreen: React.FC = () => {
  const [surface, setSurface] = useState(SURFACES[0]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Diagram loading animation</Text>
      <Text style={styles.sub}>
        "Preview reveal" shows the fade into a finished diagram.
      </Text>

      <View style={styles.chips}>
        {SURFACES.map((s) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => setSurface(s)}
            style={[styles.chip, surface.id === s.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, surface.id === s.id && styles.chipTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <PlaceholderCard key={surface.id} bg={surface.color} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 48, gap: 16 },
  heading: { fontFamily: FONTS.displayBold, fontSize: 20, color: COLORS.text },
  sub: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.text },
  chipTextActive: { color: '#FFFFFF' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 8,
  },
  cardTitle: { fontFamily: FONTS.displayBold, fontSize: 16, color: COLORS.text },
  cardBlurb: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted },
  canvas: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fakeDiagram: { alignItems: 'center', justifyContent: 'center' },
  fakeDiagramText: { fontFamily: FONTS.displayBold, fontSize: 16, color: COLORS.primary },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  buttonText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.primary },
});
