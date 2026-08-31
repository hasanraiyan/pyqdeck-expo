import React, { useMemo } from 'react';
import { Text, TextStyle } from 'react-native';
import { COLORS, FONTS } from '../theme/colors';
import { formatMathExpression } from '../utils/responsive';

/**
 * Renders a single line of text with math fragments styled as math, so a
 * question header that contains LaTeX shows `x²`, `√(x+1)` etc. instead of the
 * raw `$ ... $` source.
 *
 * Recognised delimiters:
 * - the app's own cleanMarkdown convention — backtick-wrapped `$…$` / `$$…$$`
 * - bare `$…$` / `$$…$$`
 * - LaTeX \(…\) and \[…\]
 *
 * Each math fragment is normalized with the same formatMathExpression used by
 * the full-body markdown renderer (unicode superscripts/subscripts, common
 * symbols, sqrt/fraction to plain-text), then styled serif-italic-primary so it
 * reads as math. Plain text passes through untouched.
 */
const MATH_TOKEN =
  /(`\$\$[\s\S]*?\$\$`|`\$[^\n]*?\$`|\$\$[\s\S]*?\$\$|\$[^\n$]*?\$|\\\[[\s\S]*?\\\]|\\\([^)]*?\\\))/g;
const MATH_PART =
  /^(`\$\$[\s\S]*?\$\$`|`\$[^\n]*?\$`|\$\$[\s\S]*?\$\$|\$[^\n$]*?\$|\\\[[\s\S]*?\\\]|\\\([^)]*?\\\))$/;

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

export const InlineMathText: React.FC<{
  content: string;
  style?: TextStyle;
  numberOfLines?: number;
}> = ({ content, style, numberOfLines }) => {
  const parts = useMemo(() => content.split(MATH_TOKEN), [content]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
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
