import React, { createContext, useContext, useMemo, useState } from 'react';
import { View, ScrollView, LayoutChangeEvent, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import { rf } from '../utils/responsive';

// react-native-markdown-display renders every <tr> as its own flex row, so
// columns only line up if each cell gets an explicit width. The widths are
// computed once per table from its AST and shared with the cells via context.

const MIN_COL = 88;
const MAX_COL = 240;
const CHAR_PX = 7.2;
const CELL_PAD = 28;

const TableCtx = createContext<number[]>([]);

function textOf(node: any): string {
  if (!node) return '';
  if (typeof node.content === 'string' && node.content) return node.content;
  return (node.children || []).map(textOf).join('');
}

function columnWidths(tableNode: any): number[] {
  const widths: number[] = [];
  const visit = (n: any) => {
    if (n.type === 'tr') {
      (n.children || []).forEach((cell: any, i: number) => {
        const text = textOf(cell).trim();
        const longestWord = text.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
        const floor = Math.max(MIN_COL, longestWord * CHAR_PX + CELL_PAD);
        const ideal = text.length * CHAR_PX + CELL_PAD;
        // Long prose wraps at MAX_COL, but a single long word is never clipped.
        const w = Math.max(floor, Math.min(MAX_COL, ideal));
        widths[i] = Math.max(widths[i] ?? 0, w);
      });
    } else {
      (n.children || []).forEach(visit);
    }
  };
  visit(tableNode);
  return widths;
}

export const MarkdownTable: React.FC<{ node: any; children: React.ReactNode }> = ({
  node,
  children,
}) => {
  const base = useMemo(() => columnWidths(node), [node]);
  const [available, setAvailable] = useState(0);

  const widths = useMemo(() => {
    const sum = base.reduce((a, b) => a + b, 0);
    // Narrow tables stretch to fill the card; wide ones scroll sideways.
    if (available > 0 && sum > 0 && sum < available) {
      const k = available / sum;
      return base.map((w) => w * k);
    }
    return base;
  }, [base, available]);

  const onLayout = (e: LayoutChangeEvent) => setAvailable(e.nativeEvent.layout.width);

  return (
    <View style={styles.card} onLayout={onLayout}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
        <TableCtx.Provider value={widths}>
          <View>{children}</View>
        </TableCtx.Provider>
      </ScrollView>
    </View>
  );
};

export const TableRow: React.FC<{ header?: boolean; zebra?: boolean; last?: boolean; children: React.ReactNode }> = ({
  header,
  zebra,
  last,
  children,
}) => (
  <View
    style={[
      styles.row,
      header && styles.headerRow,
      zebra && styles.zebra,
      last && styles.lastRow,
    ]}
  >
    {children}
  </View>
);

export const TableCell: React.FC<{ index: number; header?: boolean; last?: boolean; children: React.ReactNode }> = ({
  index,
  header,
  last,
  children,
}) => {
  const widths = useContext(TableCtx);
  const textStyle = header
    ? { fontWeight: '700' as const, fontSize: rf(12.5), lineHeight: rf(18), color: COLORS.text }
    : { fontSize: rf(13), lineHeight: rf(19), color: COLORS.text };

  // The cell content is a single inline <Text>; styling it (rather than
  // wrapping it in another Text) keeps inline-math children valid.
  const content = React.Children.map(children, (c) =>
    React.isValidElement<{ style?: unknown }>(c) ? React.cloneElement(c, { style: [c.props.style, textStyle] }) : c
  );

  return (
    <View style={[styles.cell, header && styles.headerCell, last && styles.lastCell, { width: widths[index] }]}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 12,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerRow: {
    backgroundColor: COLORS.cardSecondary,
    borderBottomWidth: 1.5,
  },
  zebra: {
    backgroundColor: COLORS.cardSecondary + '66',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border,
    justifyContent: 'center',
  },
  headerCell: {
    justifyContent: 'flex-end',
  },
  lastCell: {
    borderRightWidth: 0,
  },
});
