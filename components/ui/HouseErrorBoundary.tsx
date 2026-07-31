import React, { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HousePrimaryButton } from '@/components/ui/HousePrimaryButton';
import { SerifText } from '@/components/ui/SerifText';
import { GustraColors } from '@/constants/Colors';
import { bodyTextStyle, Theme } from '@/constants/Theme';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { Sentry } from '@/services/monitoring/sentry';

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
};

type State = {
  hasError: boolean;
};

/**
 * Reusable screen-level React Error Boundary (Swift `CrashRecoveryContainer`).
 * Isolates crashes to single views/tabs, logs to Sentry, and offers an in-app reset.
 */
export class HouseErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { extra: errorInfo as never });
    if (__DEV__) {
      console.error('[HouseErrorBoundary] caught crash:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <SerifText size={22} weight="bold" style={styles.title}>
            {this.props.fallbackTitle ?? 'Er ging iets mis'}
          </SerifText>
          <Text style={styles.message}>
            {this.props.fallbackMessage ??
              'Dit scherm kon niet correct geladen worden. Onze excuses voor het ongemak.'}
          </Text>
          <HousePrimaryButton
            title="Probeer opnieuw"
            onPress={this.handleReset}
            style={styles.button}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GustraColors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    color: GustraColors.ratingAvoid,
    textAlign: 'center',
  },
  message: {
    ...bodyTextStyle,
    fontSize: 15,
    color: 'rgba(35, 32, 26, 0.65)',
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    paddingHorizontal: 24,
  },
});
