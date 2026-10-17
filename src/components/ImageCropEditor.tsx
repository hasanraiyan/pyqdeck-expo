import React from 'react';
import { PaperPageEditor } from './PaperPageEditor';

export interface ImageCropEditorProps {
  /** The local URI of the image to edit. Passing null hides the editor modal. */
  uri: string | null;
  /** Header title displayed at the top of the editor. Defaults to 'Edit Photo'. */
  title?: string;
  /** Called when the user taps Cancel or dismisses the editor without saving. */
  onCancel: () => void;
  /** Called with the new local file URI after applying crop/rotation/perspective. */
  onDone: (newUri: string) => void;
}

/**
 * Reusable full-screen image editor adapted from the admin paper scan pipeline:
 * - 90° clockwise and counter-clockwise rotation (baked with expo-image-manipulator)
 * - Fine degree straightening/tilt slider with numerical feedback
 * - Rectangular crop frame with rule-of-thirds grid and draggable handles
 * - Document perspective correction (4-corner quad warp with CornerLoupe zoom)
 * - Reset to original image bounds
 */
export const ImageCropEditor: React.FC<ImageCropEditorProps> = ({
  uri,
  title = 'Edit Photo',
  onCancel,
  onDone,
}) => {
  return (
    <PaperPageEditor
      uri={uri}
      pageLabel={title}
      onCancel={onCancel}
      onDone={onDone}
    />
  );
};
