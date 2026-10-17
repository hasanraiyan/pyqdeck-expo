import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';
import {
  PYQDECK_BRANCHES,
  BranchItem,
  BranchFilterCategory,
  searchBranches,
} from '../../data/branches';

interface BranchPickerBottomSheetProps {
  visible: boolean;
  selectedBranch?: string;
  onSelect: (branchName: string, branchCode?: string) => void;
  onClose: () => void;
  asModal?: boolean;
}

export const BranchPickerBottomSheet: React.FC<BranchPickerBottomSheetProps> = ({
  visible,
  selectedBranch = '',
  onSelect,
  onClose,
  asModal = false,
}) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<BranchFilterCategory>('all');
  const [customInputActive, setCustomInputActive] = useState(false);
  const [customBranchText, setCustomBranchText] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // Animation for smooth entry
  const slideAnim = useRef(new Animated.Value(450)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setCustomInputActive(false);
      setCustomBranchText('');
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          stiffness: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 450,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  const filteredBranches = useMemo(() => {
    return searchBranches(searchQuery, activeCategory);
  }, [searchQuery, activeCategory]);

  const handleSelectItem = (item: BranchItem) => {
    Haptics.selectionAsync().catch(() => {});
    onSelect(item.name, item.code);
    onClose();
  };

  const handleSelectCustom = (customName: string) => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    Haptics.selectionAsync().catch(() => {});
    onSelect(trimmed);
    onClose();
  };

  if (!visible) return null;

  const sheetBody = (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />
      </Animated.View>

      {/* Sheet Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Grab Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.sheetTitle}>Select Engineering Branch</Text>
              <Text style={styles.sheetSubtitle}>
                34 Official BEU Engineering Disciplines & Specializations
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeBtn}
              accessibilityLabel="Close branch picker"
            >
              <Feather name="x" size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* Search Input Box */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={17} color="#64748b" style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (customInputActive) setCustomInputActive(false);
              }}
              placeholder="Search branch code or name (e.g. CSE, AI, ME, Civil)..."
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter Chips with Horizontal X-Axis Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
            style={styles.chipScrollView}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveCategory('all');
              }}
              style={[
                styles.filterChip,
                activeCategory === 'all' && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeCategory === 'all' && styles.filterChipTextActive,
                ]}
              >
                All (34)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveCategory('cs_it');
              }}
              style={[
                styles.filterChip,
                activeCategory === 'cs_it' && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeCategory === 'cs_it' && styles.filterChipTextActive,
                ]}
              >
                CS & IT (11)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveCategory('electrical_electronics');
              }}
              style={[
                styles.filterChip,
                activeCategory === 'electrical_electronics' && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeCategory === 'electrical_electronics' && styles.filterChipTextActive,
                ]}
              >
                Electrical (6)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveCategory('mechanical_robotics');
              }}
              style={[
                styles.filterChip,
                activeCategory === 'mechanical_robotics' && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeCategory === 'mechanical_robotics' && styles.filterChipTextActive,
                ]}
              >
                Mech & Robotics (4)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveCategory('civil');
              }}
              style={[
                styles.filterChip,
                activeCategory === 'civil' && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeCategory === 'civil' && styles.filterChipTextActive,
                ]}
              >
                Civil (2)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveCategory('chemical_specialized');
              }}
              style={[
                styles.filterChip,
                activeCategory === 'chemical_specialized' && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeCategory === 'chemical_specialized' && styles.filterChipTextActive,
                ]}
              >
                Specialized (11)
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Quick Match for Search Query */}
          {searchQuery.trim().length > 1 && (
            <TouchableOpacity
              style={styles.customMatchCard}
              onPress={() => handleSelectCustom(searchQuery)}
              activeOpacity={0.7}
            >
              <View style={styles.customMatchLeft}>
                <Feather name="plus-circle" size={16} color={COLORS.primary} />
                <Text style={styles.customMatchText} numberOfLines={1}>
                  Use <Text style={styles.customMatchHighlight}>"{searchQuery.trim()}"</Text>
                </Text>
              </View>
              <Text style={styles.customMatchBadge}>Custom Branch</Text>
            </TouchableOpacity>
          )}

          {/* Custom Entry Toggle Form */}
          {customInputActive ? (
            <View style={styles.customFormCard}>
              <Text style={styles.customFormTitle}>Enter Custom Branch / Stream</Text>
              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customTextInput}
                  value={customBranchText}
                  onChangeText={setCustomBranchText}
                  placeholder="e.g. Aerospace Engineering"
                  placeholderTextColor="#94a3b8"
                  autoFocus
                />
                <TouchableOpacity
                  style={[
                    styles.customConfirmBtn,
                    !customBranchText.trim() && styles.customConfirmBtnDisabled,
                  ]}
                  onPress={() => handleSelectCustom(customBranchText)}
                  disabled={!customBranchText.trim()}
                >
                  <Text style={styles.customConfirmBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setCustomInputActive(false)}
                style={styles.customCancelBtn}
              >
                <Text style={styles.customCancelBtnText}>Back to BEU Branch List</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Branch FlatList */
            <FlatList
              data={filteredBranches}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="compass-outline" size={44} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No matching branch found</Text>
                  <Text style={styles.emptySubtitle}>
                    You can type your engineering branch name manually.
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setCustomInputActive(true);
                      setCustomBranchText(searchQuery);
                    }}
                    style={styles.emptyCustomBtn}
                  >
                    <Feather name="edit-3" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.emptyCustomBtnText}>Enter Custom Branch</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected =
                  selectedBranch.toLowerCase().trim() === item.name.toLowerCase().trim() ||
                  selectedBranch.toLowerCase().trim() === item.code.toLowerCase().trim();

                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleSelectItem(item)}
                    style={[
                      styles.branchItem,
                      isSelected && styles.branchItemSelected,
                    ]}
                  >
                    {/* Branch Code Badge */}
                    <View
                      style={[
                        styles.branchCodeBadge,
                        isSelected && styles.branchCodeBadgeSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.branchCodeText,
                          isSelected && styles.branchCodeTextSelected,
                        ]}
                      >
                        {item.code}
                      </Text>
                    </View>

                    {/* Info Area */}
                    <View style={styles.branchInfo}>
                      <Text
                        style={[
                          styles.branchName,
                          isSelected && styles.branchNameSelected,
                        ]}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                    </View>

                    {/* Right Indicator */}
                    {isSelected ? (
                      <View style={styles.checkIndicator}>
                        <Feather name="check" size={16} color="#ffffff" />
                      </View>
                    ) : (
                      <Feather name="chevron-right" size={16} color="#cbd5e1" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Persistent Bottom Bar for Custom Branch Entry */}
          {!customInputActive && (
            <View style={styles.bottomManualBar}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setCustomInputActive(true);
                }}
                style={styles.manualEntryBtn}
              >
                <Feather name="edit" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.manualEntryText}>
                  Can't find your branch? Type manually
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );

  if (asModal) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        {sheetBody}
      </Modal>
    );
  }

  return sheetBody;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  keyboardAvoid: {
    width: '100%',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Math.min(SCREEN_HEIGHT * 0.82, 680),
    minHeight: 460,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 20,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 38,
    height: 4.5,
    borderRadius: RADIUS.full,
    backgroundColor: '#cbd5e1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  sheetTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 17.5,
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: RADIUS.lg,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: FONTS.body,
    fontSize: 13.5,
    color: '#0f172a',
  },
  clearBtn: {
    padding: 4,
  },
  chipScrollView: {
    maxHeight: 52,
  },
  chipScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontFamily: FONTS.bodySemi,
  },
  customMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginHorizontal: 20,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  customMatchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  customMatchText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: '#166534',
    flex: 1,
  },
  customMatchHighlight: {
    fontFamily: FONTS.bodySemi,
    color: '#15803d',
  },
  customMatchBadge: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: '#15803d',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: RADIUS.full,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 12,
  },
  branchItemSelected: {
    backgroundColor: '#f8fafc',
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  branchCodeBadge: {
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchCodeBadgeSelected: {
    backgroundColor: COLORS.primary,
  },
  branchCodeText: {
    fontFamily: FONTS.displayBold,
    fontSize: 11.5,
    color: '#334155',
  },
  branchCodeTextSelected: {
    color: '#ffffff',
  },
  branchInfo: {
    flex: 1,
  },
  branchName: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: '#1e293b',
    lineHeight: 18,
  },
  branchNameSelected: {
    color: COLORS.primary,
    fontFamily: FONTS.displayBold,
  },
  checkIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    color: '#1e293b',
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    marginTop: 16,
  },
  emptyCustomBtnText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: '#ffffff',
  },
  customFormCard: {
    padding: 20,
    backgroundColor: '#f8fafc',
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  customFormTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 8,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customTextInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: '#0f172a',
  },
  customConfirmBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customConfirmBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  customConfirmBtnText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: '#ffffff',
  },
  customCancelBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 4,
  },
  customCancelBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: '#64748b',
    textDecorationLine: 'underline',
  },
  bottomManualBar: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  manualEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  manualEntryText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12.5,
    color: COLORS.primary,
  },
});
