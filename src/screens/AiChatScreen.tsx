import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLinkTo, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ApiError } from '../api';
import {
  streamAiChat,
  AiChatEvent,
  CHAT_DISABLED,
  CHAT_BAD_CONVERSATION,
  CHAT_TURN_LIMIT,
} from '../api/aiChat';
import { aiOverviewStatusQuery } from '../api/queries';
import { useRequireAuth } from '../auth/useRequireAuth';
import { NativeContentRenderer } from '../components/NativeContentRenderer';
import { SourcesSheet } from '../components/SourcesSheet';
import { ThinkingIndicator } from '../components/ThinkingIndicator';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { AiOverview, AiOverviewReference } from '../types';
import { MESSAGES } from '../utils/netError';
import { openAiReference } from '../utils/openAiReference';
import { rf, useResponsive } from '../utils/responsive';

/**
 * Chat over the AI overview: a streamed answer per question, follow-up chips
 * under each answer, and the conversation remembered server-side.
 *
 * Reached only from the overview card, through the sign-in guard, and only
 * while the server's `chat` switch is on. It still re-checks both: the status
 * is re-read every time this opens, and a `chat_disabled` event mid-chat (an
 * admin flipped the switch) turns the composer off without losing the
 * transcript.
 */

const MAX_QUESTION_LENGTH = 200;
// How often streamed text is pushed into React state. Per-token setState
// storms are how a streaming screen drops frames; the final flush on `done`
// is authoritative, so the throttle costs nothing in correctness.
const FLUSH_MS = 80;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  refs: AiOverviewReference[];
  related: string[];
  status: 'streaming' | 'done' | 'error';
  /** Server-reported activity ("Searching: ..."), shown while thinking. */
  step?: string;
  /** For an assistant message: the question it answers, so Retry can re-ask. */
  question?: string;
  error?: { code: string; message: string };
}

export const AiChatScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const linkTo = useLinkTo();
  const route = useRoute<any>();
  const { readMaxWidth, hPadding } = useResponsive();
  const { isSignedIn, isLoaded, guard } = useRequireAuth();

  const seedQuery: string = route.params?.query ?? '';
  const seedOverview: AiOverview | null = route.params?.overview ?? null;

  const idRef = useRef(0);
  const nextId = () => `m${++idRef.current}`;

  // The overview the student was reading is the first exchange, so the chat
  // opens with context on screen rather than empty.
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!seedQuery || !seedOverview?.text) return [];
    return [
      { id: nextId(), role: 'user', text: seedQuery, refs: [], related: [], status: 'done' },
      {
        id: nextId(),
        role: 'assistant',
        text: seedOverview.text,
        refs: seedOverview.references ?? [],
        related: seedOverview.relatedQuestions ?? [],
        status: 'done',
      },
    ];
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [chatOff, setChatOff] = useState(false);
  const [chatFull, setChatFull] = useState(false);
  const [sheetRefs, setSheetRefs] = useState<AiOverviewReference[] | null>(null);

  // Server conversation token: absent until the first turn's `meta` event.
  const conversationRef = useRef<string | null>(null);
  // The search this chat grew out of, sent on the first turn only.
  const aboutRef = useRef<string | null>(seedOverview?.text ? seedQuery || null : null);
  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef('');
  const listRef = useRef<FlatList<Message>>(null);
  const stickRef = useRef(true);

  // A fresh read every time the chat opens (the shared status query otherwise
  // only refreshes every few minutes), so a disabled feature is caught here.
  const statusQ = useQuery({ ...aiOverviewStatusQuery(), staleTime: 0, refetchOnMount: 'always' });
  const unavailable = chatOff || (statusQ.data !== undefined && !statusQ.data.chat);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runTurn = useCallback(async (question: string, assistantId: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    bufferRef.current = '';
    setBusy(true);
    stickRef.current = true;

    const patch = (fn: (m: Message) => Message) =>
      setMessages((ms) => ms.map((m) => (m.id === assistantId ? fn(m) : m)));

    const timer = setInterval(() => {
      const text = bufferRef.current;
      patch((m) => (m.text === text ? m : { ...m, text }));
    }, FLUSH_MS);

    let finished = false;
    const finish = (status: Message['status'], error?: Message['error']) => {
      finished = true;
      patch((m) => ({ ...m, text: bufferRef.current || m.text, status, error, step: undefined }));
    };

    const onEvent = (e: AiChatEvent) => {
      switch (e.type) {
        case 'meta':
          conversationRef.current = e.conversationId || conversationRef.current;
          break;
        case 'step':
          patch((m) => ({ ...m, step: e.label }));
          break;
        case 'references':
          patch((m) => ({ ...m, refs: e.references }));
          break;
        case 'delta':
          bufferRef.current += e.text;
          break;
        case 'related':
          patch((m) => ({ ...m, related: e.questions }));
          break;
        case 'done':
          finish('done');
          break;
        case 'error':
          if (e.code === CHAT_DISABLED) setChatOff(true);
          if (e.code === CHAT_TURN_LIMIT) setChatFull(true);
          if (e.code === CHAT_BAD_CONVERSATION) {
            // The server no longer knows this chat; the next question starts
            // a new one (the original search is re-sent as context).
            conversationRef.current = null;
            aboutRef.current = seedQuery || null;
          }
          finish('error', { code: e.code, message: e.message || MESSAGES.unknown });
          break;
      }
    };

    try {
      await streamAiChat({
        query: question,
        about: conversationRef.current ? undefined : (aboutRef.current ?? undefined),
        conversationId: conversationRef.current,
        signal: controller.signal,
        onEvent,
      });
      if (!finished) {
        if (controller.signal.aborted) {
          // Stop: keep whatever arrived; with nothing, offer Retry.
          if (bufferRef.current) finish('done');
          else finish('error', { code: 'stopped', message: 'Stopped.' });
        } else {
          finish('error', { code: 'interrupted', message: MESSAGES.unreachable });
        }
      }
    } catch (err: any) {
      const status = err instanceof ApiError ? err.status : undefined;
      finish('error', {
        code: status === 401 ? 'unauthorized' : status === 429 ? 'rate_limited' : 'network',
        message: err?.message || MESSAGES.unknown,
      });
    } finally {
      clearInterval(timer);
      abortRef.current = null;
      setBusy(false);
    }
  }, [seedQuery]);

  const ask = useCallback(
    (raw: string) => {
      const question = raw.trim().slice(0, MAX_QUESTION_LENGTH);
      if (!question || busy || unavailable || chatFull) return;
      Haptics.selectionAsync().catch(() => {});
      const assistantId = nextId();
      setMessages((ms) => [
        // Chips belong to the latest answer only; asking moves on from them.
        ...ms.map((m) => (m.related.length ? { ...m, related: [] } : m)),
        { id: nextId(), role: 'user', text: question, refs: [], related: [], status: 'done' },
        {
          id: assistantId,
          role: 'assistant',
          text: '',
          refs: [],
          related: [],
          status: 'streaming',
          question,
        },
      ]);
      setInput('');
      void runTurn(question, assistantId);
    },
    [busy, unavailable, chatFull, runTurn]
  );

  const retry = (msg: Message) => {
    if (!msg.question || busy) return;
    const question = msg.question;
    setMessages((ms) =>
      ms.map((m) =>
        m.id === msg.id
          ? { ...m, text: '', refs: [], related: [], status: 'streaming', error: undefined }
          : m
      )
    );
    void runTurn(question, msg.id);
  };

  const stop = () => {
    Haptics.selectionAsync().catch(() => {});
    abortRef.current?.abort();
  };

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    conversationRef.current = null;
    aboutRef.current = null;
    setMessages([]);
    setChatFull(false);
    setInput('');
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Ask AI',
      headerRight: () =>
        messages.length > 0 ? (
          <TouchableOpacity
            onPress={newChat}
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="edit" size={18} color={COLORS.text} />
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, messages.length, newChat]);

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const renderItem = ({ item }: { item: Message }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.userRow}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    const isLast = item.id === lastAssistantId;
    return (
      <View style={styles.assistantRow}>
        {item.status === 'streaming' && !item.text ? (
          <ThinkingIndicator label={item.step} />
        ) : (
          <NativeContentRenderer content={item.text} fontSize={rf(14)} />
        )}

        {item.status === 'error' && item.error && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color={COLORS.primary} />
            <Text style={styles.errorText}>{item.error.message}</Text>
            {item.error.code === 'unauthorized' ? (
              <TouchableOpacity onPress={() => guard(() => retry(item), 'ai')}>
                <Text style={styles.errorAction}>Sign in</Text>
              </TouchableOpacity>
            ) : item.question &&
              item.error.code !== CHAT_DISABLED &&
              item.error.code !== CHAT_TURN_LIMIT ? (
              <TouchableOpacity onPress={() => retry(item)}>
                <Text style={styles.errorAction}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {item.status === 'done' && item.refs.length > 0 && (
          <TouchableOpacity
            style={styles.sourcesPill}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setSheetRefs(item.refs);
            }}
          >
            <Feather name="link" size={13} color={COLORS.textMuted} />
            <Text style={styles.sourcesPillText}>Sources</Text>
          </TouchableOpacity>
        )}

        {isLast && item.status === 'done' && item.related.length > 0 && !unavailable && !chatFull && (
          <View style={styles.chips}>
            {item.related.map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.chip}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={q}
                disabled={busy}
                onPress={() => ask(q)}
              >
                <Feather name="corner-down-right" size={13} color={COLORS.textMuted} />
                <Text style={styles.chipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const signedOut = isLoaded && !isSignedIn;
  const composerHidden = unavailable || chatFull;
  const canSend = input.trim().length > 0 && !busy && !signedOut;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: hPadding, maxWidth: readMaxWidth, alignSelf: 'center', width: '100%' },
        ]}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => {
          stickRef.current = false;
        }}
        onContentSizeChange={() => {
          if (stickRef.current) listRef.current?.scrollToEnd({ animated: false });
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={26} color={COLORS.textSubtle} />
            <Text style={styles.emptyTitle}>Ask about your papers and notes</Text>
            <Text style={styles.emptyBody}>
              Answers come from PYQDeck's past papers and study notes.
            </Text>
          </View>
        }
      />

      {unavailable ? (
        <View style={[styles.banner, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.bannerText}>AI chat is currently unavailable.</Text>
        </View>
      ) : chatFull ? (
        <View style={[styles.banner, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.bannerText}>This chat is full.</Text>
          <TouchableOpacity onPress={newChat}>
            <Text style={styles.errorAction}>Start a new chat</Text>
          </TouchableOpacity>
        </View>
      ) : signedOut ? (
        <View style={[styles.banner, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.bannerText}>Sign in to keep chatting.</Text>
          <TouchableOpacity onPress={() => guard(() => {}, 'ai')}>
            <Text style={styles.errorAction}>Sign in</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!composerHidden && !signedOut && (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask a follow-up…"
            placeholderTextColor={COLORS.textSubtle}
            multiline
            maxLength={MAX_QUESTION_LENGTH}
            editable={!busy}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => ask(input)}
            accessibilityLabel="Ask a follow-up question"
          />
          {busy ? (
            <TouchableOpacity
              style={[styles.sendBtn, styles.stopBtn]}
              onPress={stop}
              accessibilityRole="button"
              accessibilityLabel="Stop"
            >
              <Feather name="square" size={15} color={COLORS.card} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnOff]}
              onPress={() => ask(input)}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <Feather name="arrow-up" size={18} color={COLORS.card} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <SourcesSheet
        refs={sheetRefs}
        onClose={() => setSheetRefs(null)}
        onPressReference={(ref) => openAiReference(navigation, linkTo, ref)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  list: { paddingTop: 12, paddingBottom: 16, flexGrow: 1 },
  userRow: { alignItems: 'flex-end', marginBottom: 14 },
  userBubble: {
    maxWidth: '85%',
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: {
    fontFamily: FONTS.sans,
    fontSize: rf(14),
    lineHeight: rf(20),
    color: COLORS.text,
  },
  assistantRow: { marginBottom: 20 },
  sourcesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    minHeight: 32,
    paddingHorizontal: 13,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  sourcesPillText: {
    fontFamily: FONTS.sans,
    fontSize: rf(12),
    fontWeight: '500',
    color: COLORS.text,
  },
  chips: { marginTop: 12, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    maxWidth: '100%',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.cardSecondary,
  },
  chipText: {
    flexShrink: 1,
    fontFamily: FONTS.sans,
    fontSize: rf(13),
    lineHeight: rf(18),
    color: COLORS.text,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  errorText: {
    flexShrink: 1,
    fontFamily: FONTS.sans,
    fontSize: rf(12.5),
    color: COLORS.textMuted,
  },
  errorAction: {
    fontFamily: FONTS.sans,
    fontSize: rf(13),
    fontWeight: '600',
    color: COLORS.primary,
  },
  empty: { alignItems: 'center', gap: 8, paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: {
    fontFamily: FONTS.sans,
    fontSize: rf(15),
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: FONTS.sans,
    fontSize: rf(13),
    lineHeight: rf(19),
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  bannerText: {
    fontFamily: FONTS.sans,
    fontSize: rf(13),
    color: COLORS.textMuted,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    fontFamily: FONTS.sans,
    fontSize: rf(14),
    color: COLORS.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  sendBtnOff: { opacity: 0.35 },
  stopBtn: { backgroundColor: COLORS.text },
});
