import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * The Syllabus tab's icon, drawn rather than picked from Feather.
 *
 * It is a checklist: three ruled lines, the first one ticked and the rest still
 * waiting - which is exactly what the tab opens onto, and something no icon in
 * the Feather set says. The app's other drawn marks (AskAiBadge, DoneStamp) are
 * deliberately wobbly, but a tab icon sits beside Feather's `book-open` and
 * `search`, so this one is built on their grid instead: 24x24, 2px stroke,
 * round caps and joins. A hand-drawn line here would read as a rendering fault
 * at 24px, not as character.
 *
 * `focused` thickens the stroke slightly rather than swapping to a filled
 * variant - the tab bar already signals selection through tint, and a filled
 * glyph would out-weigh the two stroked icons next to it.
 */
export const SyllabusTabIcon = ({
  size = 24,
  color,
  focused = false,
}: {
  size?: number;
  color: string;
  focused?: boolean;
}) => {
  const sw = focused ? 2.25 : 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Row 1 - done: a tick where the other rows carry a stub. */}
      <Path
        d="M3.2 6.1 L5.1 8 L8.6 4.4"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M11.4 6.2 H20.6" stroke={color} strokeWidth={sw} strokeLinecap="round" />

      {/* Rows 2 and 3 - not yet done. */}
      <Path d="M3.6 12 H6.6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M11.4 12 H20.6" stroke={color} strokeWidth={sw} strokeLinecap="round" />

      <Path d="M3.6 17.9 H6.6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M11.4 17.9 H20.6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
};
