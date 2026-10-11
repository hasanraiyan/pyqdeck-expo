import React, { useMemo } from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import { splitHighlight } from '../utils/highlight';

type Props = TextProps & { text: string; query: string };

/** Text with the words matching `query` highlighted. Falls back to plain text. */
export const HighlightedText = ({ text, query, ...rest }: Props) => {
  const parts = useMemo(() => splitHighlight(text, query), [text, query]);
  return (
    <Text {...rest}>
      {parts.map((p, i) =>
        p.hit ? (
          <Text key={i} style={styles.hit}>
            {p.text}
          </Text>
        ) : (
          p.text
        )
      )}
    </Text>
  );
};

const styles = StyleSheet.create({
  hit: { backgroundColor: COLORS.primaryLight, color: COLORS.text },
});
