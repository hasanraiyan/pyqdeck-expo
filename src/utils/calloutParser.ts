export type CalloutType = 'note' | 'tip' | 'warning' | 'caution' | 'important' | 'exam';

export interface CalloutData {
  type: CalloutType;
  title: string;
  content: string;
}

export interface CalloutStyleConfig {
  label: string;
  icon: 'info' | 'zap' | 'alert-triangle' | 'alert-circle' | 'help-circle';
  borderColor: string;
  bgColor: string;
  badgeBg: string;
  textColor: string;
  iconColor: string;
}

export const CALLOUT_TYPE_CONFIG: Record<CalloutType, CalloutStyleConfig> = {
  note: {
    label: 'Note',
    icon: 'info',
    borderColor: '#2563eb', // Royal Blue
    bgColor: '#f0f7ff',
    badgeBg: '#dbeafe',
    textColor: '#1d4ed8',
    iconColor: '#2563eb',
  },
  tip: {
    label: 'Pro Tip',
    icon: 'zap',
    borderColor: '#16a34a', // Emerald Green
    bgColor: '#f0fdf4',
    badgeBg: '#dcfce7',
    textColor: '#15803d',
    iconColor: '#16a34a',
  },
  warning: {
    label: 'Warning',
    icon: 'alert-triangle',
    borderColor: '#d97706', // Warm Amber
    bgColor: '#fffbeb',
    badgeBg: '#fef3c7',
    textColor: '#b45309',
    iconColor: '#d97706',
  },
  exam: {
    label: 'Exam Trap',
    icon: 'alert-triangle',
    borderColor: '#ea580c', // Bright Orange
    bgColor: '#fff7ed',
    badgeBg: '#ffedd5',
    textColor: '#c2410c',
    iconColor: '#ea580c',
  },
  caution: {
    label: 'Caution',
    icon: 'alert-circle',
    borderColor: '#dc2626', // Crimson Red
    bgColor: '#fef2f2',
    badgeBg: '#fee2e2',
    textColor: '#b91c1c',
    iconColor: '#dc2626',
  },
  important: {
    label: 'Important',
    icon: 'alert-circle',
    borderColor: '#b23a2e', // Grading Red (PyQdeck Primary)
    bgColor: '#fdf2f0',
    badgeBg: '#fce7e4',
    textColor: '#8e271d',
    iconColor: '#b23a2e',
  },
};

/**
 * Regex matching the first line of a markdown callout block.
 * Matches:
 * > [!NOTE]
 * > [!TIP] Custom Title
 * > [!WARNING]
 * > [!EXAM]
 * > [!CAUTION]
 * > [!IMPORTANT]
 */
export const CALLOUT_HEADER_REGEX =
  /^>\s*\[!(NOTE|INFO|TIP|HINT|PROTIP|WARNING|WARN|EXAM|EXAM_TRAP|VIVA|CAUTION|CRUCIAL|IMPORTANT|DANGER)\][ \t]*(.*)$/i;

/**
 * Regex matching an entire contiguous callout block in markdown.
 */
export const CALLOUT_BLOCK_REGEX =
  /(?:^|\r?\n)>\s*\[!(NOTE|INFO|TIP|HINT|PROTIP|WARNING|WARN|EXAM|EXAM_TRAP|VIVA|CAUTION|CRUCIAL|IMPORTANT|DANGER)\][^\r\n]*(?:\r?\n>\s?[^\r\n]*)*/gi;

/**
 * Parses a raw multiline callout block (with leading `> ` marks) into structured CalloutData.
 */
export function parseCalloutBlock(rawBlock: string): CalloutData | null {
  if (!rawBlock || typeof rawBlock !== 'string') return null;

  const lines = rawBlock.trim().split(/\r?\n/);
  if (lines.length === 0) return null;

  const headerMatch = lines[0].match(CALLOUT_HEADER_REGEX);
  if (!headerMatch) return null;

  const rawTag = headerMatch[1].toUpperCase();
  const rawTitle = headerMatch[2] ? headerMatch[2].trim() : '';

  let type: CalloutType = 'note';
  if (rawTag === 'TIP' || rawTag === 'PROTIP' || rawTag === 'HINT') {
    type = 'tip';
  } else if (rawTag === 'WARNING' || rawTag === 'WARN') {
    type = rawTitle.toLowerCase().includes('exam') ? 'exam' : 'warning';
  } else if (rawTag === 'EXAM' || rawTag === 'EXAM_TRAP' || rawTag === 'VIVA') {
    type = 'exam';
  } else if (rawTag === 'CAUTION' || rawTag === 'DANGER' || rawTag === 'CRITICAL') {
    type = 'caution';
  } else if (rawTag === 'IMPORTANT') {
    type = 'important';
  } else {
    type = 'note';
  }

  // If there are subsequent lines, those make up the content.
  // If there are no subsequent lines, rawTitle itself is the content.
  const subsequentLines = lines
    .slice(1)
    .map((line) => line.replace(/^>\s?/, ''))
    .join('\n')
    .trim();

  let title: string;
  let content: string;

  if (subsequentLines.length > 0) {
    title = rawTitle || CALLOUT_TYPE_CONFIG[type].label;
    content = subsequentLines;
  } else if (rawTitle.length > 0) {
    // Single-line callout: `> [!TIP] Always check bounds`
    title = CALLOUT_TYPE_CONFIG[type].label;
    content = rawTitle;
  } else {
    title = CALLOUT_TYPE_CONFIG[type].label;
    content = '';
  }

  return {
    type,
    title,
    content,
  };
}
