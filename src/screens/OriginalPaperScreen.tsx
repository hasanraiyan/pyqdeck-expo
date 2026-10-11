import React from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { OriginalPaperViewer } from '../components/OriginalPaperViewer';

/**
 * Paper-level viewer route for one year's original scanned paper
 * (docs/SRS-original-paper-viewer.md).
 *
 * Registered with `headerShown: false`: the route pushes like any other
 * screen (back gesture, no tab bar on deep screens) but shows no navigation
 * header - the viewer's own top bar (back, title, page counter) is its only
 * chrome.
 */
export const OriginalPaperScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { subjectId, year } = route.params ?? {};

  return (
    <OriginalPaperViewer
      subjectId={String(subjectId ?? '')}
      year={Number(year ?? 0)}
      onClose={() => navigation.goBack()}
    />
  );
};
