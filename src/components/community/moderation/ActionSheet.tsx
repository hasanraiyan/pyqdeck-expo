import React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS } from '../../../theme/colors';

export interface SheetOption {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle?: string;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  options: SheetOption[];
  onClose: () => void;
}

/** The same bottom sheet the post card's 3-dot menu uses, for any list of actions. */
export const ActionSheet: React.FC<Props> = ({ visible, title, options, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
      <View style={styles.sheet} onStartShouldSetResponder={() => true}>
        <View style={styles.handle} />
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {options.map((option, index) => (
          <TouchableOpacity
            key={option.label}
            style={[styles.item, index === options.length - 1 && { borderBottomWidth: 0 }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onClose();
              option.onPress();
            }}
            accessibilityRole="button"
          >
            <View style={[styles.iconWrap, option.destructive && { backgroundColor: '#fee2e2' }]}>
              <Feather name={option.icon} size={18} color={option.destructive ? '#dc2626' : '#374151'} />
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.label, option.destructive && { color: '#dc2626' }]}>{option.label}</Text>
              {option.subtitle ? <Text style={styles.subtitle}>{option.subtitle}</Text> : null}
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    elevation: 12,
  },
  handle: { width: 38, height: 4.5, borderRadius: 2.5, backgroundColor: '#d1d5db', alignSelf: 'center', marginBottom: 12 },
  title: { fontFamily: FONTS.displayBold, fontSize: 15, color: COLORS.text, marginBottom: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textWrap: { flex: 1 },
  label: { fontFamily: FONTS.bodySemi, fontSize: 14.5, color: '#111827' },
  subtitle: { fontFamily: FONTS.body, fontSize: 12, color: '#6b7280', marginTop: 1 },
  cancel: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: '#374151' },
});
