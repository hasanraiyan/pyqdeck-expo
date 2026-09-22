import React, { useMemo } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { COLORS, FONTS } from '../theme/colors';
import { formatMathExpression } from '../utils/responsive';

/**
 * Delimiters for inline math and environments:
 * - backtick-wrapped `$…$` / `$$…$$`
 * - bare `$…$` / `$$…$$`
 * - LaTeX \(…\) and \[…\]
 * - LaTeX matrix / tabular environments \begin{...}...\end{...}
 */
const MATH_TOKEN =
  /(`\$\$[\s\S]*?\$\$`|`\$[^\n]*?\$`|\$\$[\s\S]*?\$\$|\$[^\n$]*?\$|\\\[[\s\S]*?\\\]|\\\([^)]*?\\\)|\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases)\}[\s\S]*?\\end\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases)\})/g;

const MATH_PART =
  /^(`\$\$[\s\S]*?\$\$`|`\$[^\n]*?\$`|\$\$[\s\S]*?\$\$|\$[^\n$]*?\$|\\\[[\s\S]*?\\\]|\\\([^)]*?\\\)|\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases)\}[\s\S]*?\\end\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases)\})$/;

const mathTextStyle: TextStyle = {
  fontFamily: FONTS.serif,
  fontStyle: 'italic',
  fontWeight: '600',
  color: COLORS.primary,
};

const normalizeMath = (raw: string): string => {
  const expr = raw
    .replace(/^`/, '')
    .replace(/`$/, '')
    .replace(/^\$\$/, '')
    .replace(/\$\$$/, '')
    .replace(/^\$/, '')
    .replace(/\$$/, '')
    .replace(/^\\\[/, '')
    .replace(/\\\]$/, '')
    .replace(/^\\\(/, '')
    .replace(/\\\)$/, '');
  return formatMathExpression(expr.trim());
};

/**
 * Strips markdown clutter (headings, images, bold asterisks, hard line breaks)
 * for a clean single-line or multi-line preview text.
 */
export const cleanPreviewMarkdown = (text: string): string => {
  if (!text) return '';
  return text
    // Replace newlines with spaces so single-line preview doesn't truncate prematurely
    .replace(/\r\n/g, ' ')
    .replace(/\n+/g, ' ')
    // Remove markdown images ![alt](url)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Replace markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove leading markdown headings (#, ##, ###)
    .replace(/^#+\s*/, '')
    // Remove bold/italic markers in prose (preserving math tokens)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Collapse consecutive spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export interface InlineMathTextProps {
  content: string;
  prefix?: string;
  prefixStyle?: StyleProp<TextStyle>;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export const InlineMathText: React.FC<InlineMathTextProps> = ({
  content,
  prefix,
  prefixStyle,
  style,
  numberOfLines,
}) => {
  const parts = useMemo(() => {
    const cleaned = cleanPreviewMarkdown(content || '');
    return cleaned.split(MATH_TOKEN);
  }, [content]);

  return (
    <Text style={style} numberOfLines={numberOfLines} ellipsizeMode="tail">
      {prefix ? <Text style={prefixStyle}>{prefix}</Text> : null}
      {parts.map((part, i) => {
        if (!part) return null;
        if (MATH_PART.test(part)) {
          return (
            <Text key={i} style={mathTextStyle}>
              {normalizeMath(part)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
};
