import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';
import { COLORS } from '../theme/colors';

/**
 * The AI the "Ask AI" buttons open. Each one is a web link that takes the
 * question as a query parameter, so nothing is sent through PYQDeck's own
 * server and no API key is needed.
 *
 * Only engines that accept a prefilled prompt in the URL are listed. Gemini
 * is left out on purpose: it has no such link.
 *
 * ChatGPT, Claude, Perplexity, Grok and Copilot read the prompt from `q`, but
 * none of them document it as a stable API, so a provider can change it. That
 * is why the question is also copied to the clipboard for those engines - if
 * the box opens empty, the student can paste.
 */
export type AskAiEngineId =
  | 'coursify'
  | 'chatgpt'
  | 'claude'
  | 'perplexity'
  | 'grok'
  | 'copilot'
  | 'google';

export interface AskAiEngine {
  id: AskAiEngineId;
  name: string;
  hint: string;
  /** Opens inside the app's browser sheet rather than handing off to the OS. */
  inApp?: boolean;
  url: (q: string) => string;
}

export const ASK_AI_ENGINES: AskAiEngine[] = [
  {
    id: 'coursify',
    name: 'Coursify',
    hint: 'Default. Answers right away',
    inApp: true,
    url: (q) => `https://hasanraiyan.me/coursify?search_ai=${q}&send=true`,
  },
  { id: 'chatgpt', name: 'ChatGPT', hint: 'OpenAI', url: (q) => `https://chatgpt.com/?q=${q}` },
  { id: 'claude', name: 'Claude', hint: 'Anthropic', url: (q) => `https://claude.ai/new?q=${q}` },
  {
    id: 'perplexity',
    name: 'Perplexity',
    hint: 'Answers with sources',
    url: (q) => `https://www.perplexity.ai/search?q=${q}`,
  },
  { id: 'grok', name: 'Grok', hint: 'xAI', url: (q) => `https://grok.com/?q=${q}` },
  { id: 'copilot', name: 'Copilot', hint: 'Microsoft', url: (q) => `https://copilot.microsoft.com/?q=${q}` },
  {
    id: 'google',
    name: 'Google AI Mode',
    hint: 'Google Search, AI answer',
    url: (q) => `https://www.google.com/search?udm=50&q=${q}`,
  },
];

export const ASK_AI_KEY = 'ask_ai_engine';
const KEY = ASK_AI_KEY;
const DEFAULT_ENGINE: AskAiEngineId = 'coursify';
/** Keeps the URL well under what browsers and WAFs accept. */
const MAX_QUESTION_CHARS = 1500;

export async function getAskAiEngine(): Promise<AskAiEngineId> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return ASK_AI_ENGINES.some((e) => e.id === raw) ? (raw as AskAiEngineId) : DEFAULT_ENGINE;
  } catch {
    return DEFAULT_ENGINE;
  }
}

export async function setAskAiEngine(id: AskAiEngineId): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {}
}

/** Opens the student's chosen AI with the question already filled in. */
export async function openAskAi(questionText: string): Promise<void> {
  const text = questionText.trim().slice(0, MAX_QUESTION_CHARS);
  if (!text) return;

  const id = await getAskAiEngine();
  const engine = ASK_AI_ENGINES.find((e) => e.id === id) ?? ASK_AI_ENGINES[0];
  const url = engine.url(encodeURIComponent(text));

  if (engine.inApp) {
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: COLORS.card,
        controlsColor: COLORS.primary,
        secondaryToolbarColor: COLORS.background,
        showTitle: true,
        enableBarCollapsing: true,
      });
    } catch {
      await Linking.openURL(url).catch(() => {});
    }
    return;
  }

  // Fallback for a provider that ignores the link parameter.
  await Clipboard.setStringAsync(text).catch(() => {});
  // Linking lets an installed ChatGPT / Claude app catch the link; the
  // in-app browser is the fallback when nothing handles it.
  try {
    await Linking.openURL(url);
  } catch {
    await WebBrowser.openBrowserAsync(url).catch(() => {});
  }
}
