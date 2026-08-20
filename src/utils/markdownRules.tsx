import React from 'react';
import FitImage from 'react-native-fit-image';
import { RenderRules, ASTNode } from 'react-native-markdown-display';

// react-native-markdown-display's built-in `image` rule puts `key` inside the props
// object it spreads onto <FitImage>, which React flags as an error ("A props object
// containing a key prop is being spread into JSX"). This is the same rule with `key`
// pulled out and passed directly instead of spread.
const image: RenderRules['image'] = (
  node: ASTNode,
  children,
  parent,
  styles,
  allowedImageHandlers,
  defaultImageHandler
) => {
  const { src, alt } = node.attributes;

  const show =
    allowedImageHandlers.filter((value: string) =>
      src.toLowerCase().startsWith(value.toLowerCase())
    ).length > 0;

  if (show === false && defaultImageHandler === null) {
    return null;
  }

  const imageProps: Record<string, any> = {
    indicator: true,
    style: styles._VIEW_SAFE_image,
    source: {
      uri: show === true ? src : `${defaultImageHandler}${src}`,
    },
  };

  if (alt) {
    imageProps.accessible = true;
    imageProps.accessibilityLabel = alt;
  }

  return <FitImage key={node.key} {...imageProps} />;
};

export const markdownRules: RenderRules = { image };
