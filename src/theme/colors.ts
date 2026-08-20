import { Platform } from 'react-native';

export const COLORS = {
  // "Exam paper" Light Palette (exact from pyqdeck-frontend globals.css)
  background: '#f5f6f2', // cool photocopy-paper background
  card: '#ffffff',
  cardSecondary: '#ebede7',
  border: '#dbdfd7',
  borderLight: '#e4e7e0',
  borderDashed: '#c8cdc3',
  text: '#1b2430', // ink-navy text
  textMuted: '#5b6472',
  textSubtle: '#8a94a6',
  primary: '#b23a2e', // red grading pen accent
  primaryLight: 'rgba(178, 58, 46, 0.08)',
  primaryBorder: 'rgba(178, 58, 46, 0.25)',
  secondary: '#1f4b43', // exam-stamp teal
  secondaryLight: 'rgba(31, 75, 67, 0.1)',
  accent: '#efe9de',
};

export const FONTS = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
};

