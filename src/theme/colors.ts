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
  success: '#16a34a',
};

export const FONTS = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
};

export const RADIUS = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 10,
  xl: 14,
  full: 9999,
  pill: 9999,
};

export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
};


