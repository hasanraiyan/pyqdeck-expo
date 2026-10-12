import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';

// One shell for every admin editor (topic, module, subject, notes). It owns the
// things each sheet used to get wrong on its own:
//   - the keyboard: the body shrinks above it, so the focused field and the Save
//     button are never covered (KeyboardAvoidingView + a footer that sits on it)
//   - the footer: Save/Delete stay pinned, no scrolling to find them
//   - leaving: a dirty editor asks before closing (close button AND Android back)
//   - the keyboard flow: EditorField chains Next -> Next -> Done(=Save)

const DANGER = '#b91c1c';

type Guard = () => void;
const GuardCtx = createContext<React.MutableRefObject<Guard | null> | null>(null);
const KeyboardCtx = createContext(false);

/** True while the on-screen keyboard is up: editors drop their extra chrome to give the text room. */
export const useEditorKeyboardOpen = () => useContext(KeyboardCtx);

/** Full-screen modal host. Drop-in replacement for Modal + SafeAreaView + ScrollView. */
export const EditorModal = ({
  visible,
  onRequestClose,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}) => {
  const guard = useRef<Guard | null>(null);
  const keyboardOpen = useKeyboardOpen();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => (guard.current ? guard.current() : onRequestClose())}
    >
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <KeyboardCtx.Provider value={keyboardOpen}>
            <GuardCtx.Provider value={guard}>{children}</GuardCtx.Provider>
          </KeyboardCtx.Provider>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setOpen(true)
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setOpen(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

export interface FooterAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Primary only: nothing to do right now (e.g. "No changes"). Drawn calm, not as a broken button. */
  idle?: boolean;
}

export const EditorFrame = ({
  kicker,
  title,
  subtitle,
  dirty,
  busy,
  onClose,
  primary,
  secondary,
  scroll = true,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  /** Unsaved edits: shows the badge and makes closing ask first. */
  dirty: boolean;
  /** A request is in flight: closing is blocked. */
  busy: boolean;
  onClose: () => void;
  primary: FooterAction;
  /** Left of the primary button; styled as destructive when `danger`. */
  secondary?: FooterAction & { danger?: boolean };
  /** false = the body fills the space itself (the notes editor); true = it scrolls. */
  scroll?: boolean;
  children: React.ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  const keyboardOpen = useContext(KeyboardCtx);
  const guard = useContext(GuardCtx);

  const requestClose = () => {
    if (busy) return;
    if (!dirty) {
      onClose();
      return;
    }
    Keyboard.dismiss();
    Alert.alert('Discard changes?', 'Your edits have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  // Android back / modal dismiss goes through the same check as the X button.
  const latest = useRef(requestClose);
  latest.current = requestClose;
  useEffect(() => {
    if (!guard) return;
    guard.current = () => latest.current();
    return () => {
      guard.current = null;
    };
  }, [guard]);

  return (
    <View style={s.frame}>
      <View style={[s.header, keyboardOpen && s.headerCompact]}>
        <TouchableOpacity
          onPress={requestClose}
          hitSlop={10}
          style={s.closeBtn}
          accessibilityLabel="Close editor"
        >
          <Feather name="x" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {keyboardOpen ? null : <Text style={s.kicker}>{kicker.toUpperCase()}</Text>}
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && !keyboardOpen ? (
            <Text style={s.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {dirty ? (
          <View style={s.dirtyPill}>
            <View style={s.dirtyDot} />
            <Text style={s.dirtyText}>Unsaved</Text>
          </View>
        ) : null}
      </View>

      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[s.body, { flex: 1 }]}>{children}</View>
      )}

      <View
        style={[
          s.footer,
          keyboardOpen
            ? { paddingTop: 6, paddingBottom: 6 }
            : { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
        {secondary ? (
          <TouchableOpacity
            onPress={secondary.onPress}
            disabled={secondary.disabled || secondary.loading}
            style={[
              s.btn,
              keyboardOpen && s.btnCompact,
              secondary.danger ? s.btnDanger : s.btnGhost,
              secondary.disabled && { opacity: 0.4 },
            ]}
            accessibilityLabel={secondary.label}
          >
            {secondary.loading ? (
              <ActivityIndicator color={secondary.danger ? DANGER : COLORS.textMuted} />
            ) : (
              <Text style={[s.btnText, { color: secondary.danger ? DANGER : COLORS.textMuted }]}>
                {secondary.label}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={primary.onPress}
          disabled={primary.disabled || primary.loading}
          style={[
            s.btn,
            keyboardOpen && s.btnCompact,
            primary.idle ? s.btnIdle : s.btnPrimary,
            { flex: 1 },
            primary.disabled && !primary.idle && { opacity: 0.45 },
          ]}
          accessibilityLabel={primary.label}
        >
          {primary.loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[s.btnText, { color: primary.idle ? COLORS.textMuted : '#fff' }]}>
              {primary.label}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * Labelled input with a focus ring, inline error and hint. Wire `returnKeyType`
 * + `onSubmitEditing` to chain fields: next -> next -> done (which saves).
 */
export const EditorField = forwardRef<
  TextInput,
  { label: string; hint?: string; error?: string | null; optional?: boolean } & TextInputProps
>(({ label, hint, error, optional, style, onFocus, onBlur, ...props }, ref) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <View style={s.labelRow}>
        <Text style={s.label}>{label}</Text>
        {optional ? <Text style={s.optional}>optional</Text> : null}
      </View>
      <TextInput
        ref={ref}
        placeholderTextColor={COLORS.textSubtle}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          s.input,
          focused && s.inputFocused,
          error ? s.inputError : null,
          props.multiline && { minHeight: 96, textAlignVertical: 'top' },
          style,
        ]}
      />
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
});
EditorField.displayName = 'EditorField';

/** Pill choice row (theory/lab, edit/preview). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => onChange(o.value)}
            disabled={disabled}
            style={[s.segItem, active && s.segActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[s.segText, active && { color: '#fff' }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Red banner for a failed save, shown right above the footer's fields. */
export const ErrorBanner = ({ message }: { message: string | null }) =>
  message ? (
    <View style={s.banner}>
      <Feather name="alert-circle" size={15} color={DANGER} />
      <Text style={s.bannerText}>{message}</Text>
    </View>
  ) : null;

/** "You have an unsaved draft from earlier" with Restore / Discard. */
export const DraftBanner = ({
  age,
  onRestore,
  onDiscard,
}: {
  age: string;
  onRestore: () => void;
  onDiscard: () => void;
}) => (
  <View style={s.draft}>
    <Feather name="clock" size={15} color="#92400e" />
    <Text style={s.draftText}>Unsaved draft from {age}.</Text>
    <TouchableOpacity onPress={onRestore} hitSlop={8} accessibilityLabel="Restore draft">
      <Text style={s.draftAction}>Restore</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={onDiscard} hitSlop={8} accessibilityLabel="Discard draft">
      <Text style={[s.draftAction, { color: COLORS.textMuted }]}>Discard</Text>
    </TouchableOpacity>
  </View>
);

export const EditorNote = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.hint}>{children}</Text>
);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  frame: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 1.2, color: COLORS.primary },
  title: { fontFamily: FONTS.displayBold, fontSize: 16, color: COLORS.text },
  subtitle: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted },
  dirtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  dirtyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d97706' },
  dirtyText: { fontFamily: FONTS.bodySemi, fontSize: 11, color: '#92400e' },
  body: { padding: 16, gap: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  btn: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnIdle: { backgroundColor: COLORS.cardSecondary, borderWidth: 1, borderColor: COLORS.border },
  btnCompact: { minHeight: 42 },
  headerCompact: { paddingVertical: 4 },
  btnGhost: { borderWidth: 1, borderColor: COLORS.border },
  btnDanger: { borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  btnText: { fontFamily: FONTS.bodySemi, fontSize: 15 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  label: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.text },
  optional: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSubtle },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
  inputFocused: { borderColor: COLORS.primary, borderWidth: 1.5 },
  inputError: { borderColor: DANGER },
  error: { fontFamily: FONTS.bodySemi, fontSize: 12, color: DANGER },
  hint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSubtle },
  seg: { flexDirection: 'row', gap: 8 },
  segItem: {
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  segText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.text },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  draft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  draftText: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#92400e' },
  draftAction: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.primary },
  bannerText: { flex: 1, fontFamily: FONTS.bodySemi, fontSize: 13, color: DANGER },
});
