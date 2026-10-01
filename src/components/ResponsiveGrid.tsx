import React, { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { getCardWidth, getGridColumns } from '../theme/layout';

interface Props<T> {
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  /** Render one card. Give the card root `style={{ width: cardWidth }}`. */
  renderItem: (item: T, info: { cardWidth: number; columns: number; index: number }) => React.ReactNode;
  /** Narrowest a card may get before a column is dropped. */
  minCardWidth: number;
  gap?: number;
  maxColumns?: number;
  /** Restrict to column counts that tile the data cleanly (e.g. [2, 4] for 4 cards). */
  allowedColumns?: number[];
  /** Width to assume before the first layout pass, so the first paint is close. */
  estimatedWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wrapping grid whose column count comes from its own *measured* width
 * (BP-3), never from the window. On web useWindowDimensions() includes the
 * scrollbar and, with a sidebar, the window is wider than the content, so a
 * window-derived count overflows a row.
 */
export function ResponsiveGrid<T>({
  data,
  keyExtractor,
  renderItem,
  minCardWidth,
  gap = 12,
  maxColumns,
  allowedColumns,
  estimatedWidth = 0,
  style,
}: Props<T>) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);
  const track = width || estimatedWidth;
  const columns = getGridColumns(track, { minCardWidth, gap, maxColumns, allowedColumns });
  const cardWidth = getCardWidth(track, columns, gap);
  return (
    <View
      onLayout={onLayout}
      style={[{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap }, style]}
    >
      {data.map((item, index) => (
        <React.Fragment key={keyExtractor(item, index)}>
          {renderItem(item, { cardWidth, columns, index })}
        </React.Fragment>
      ))}
    </View>
  );
}
