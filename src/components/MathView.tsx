import React from 'react';
import { NativeContentRenderer, NativeContentRendererProps } from './NativeContentRenderer';

export type MathViewProps = NativeContentRendererProps;

/**
 * MathView is now 100% native vector math and syntax highlighting via NativeContentRenderer.
 * WebViews are completely eliminated.
 */
export const MathView: React.FC<MathViewProps> = NativeContentRenderer;

export default MathView;
