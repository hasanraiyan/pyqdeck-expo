import React from 'react';
import { Text } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { COLORS } from '../theme/colors';

interface Props {
  /** Raw source of the block, shown as plain text if rendering throws. */
  fallbackText?: string;
  children: React.ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Isolates a single content block (markdown / math / code) so a render error
 * in one question's content degrades to plain text instead of crashing the app.
 */
export class ContentErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.failed && prevProps.fallbackText !== this.props.fallbackText) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return this.props.fallbackText ? (
        <Text style={{ color: COLORS.text, fontSize: 15, lineHeight: 22 }}>
          {this.props.fallbackText}
        </Text>
      ) : null;
    }
    return this.props.children;
  }
}
