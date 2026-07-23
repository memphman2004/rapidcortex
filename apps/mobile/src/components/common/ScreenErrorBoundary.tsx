import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/** Catches render crashes so post-login never dies as a blank white native root. */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ScreenErrorBoundary', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0A0F1E',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ color: '#F1F5F9', fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
          Something went wrong
        </Text>
        <Text
          style={{
            color: '#94A3B8',
            fontSize: 14,
            textAlign: 'center',
            marginTop: 12,
          }}
        >
          {this.state.error.message}
        </Text>
        <Pressable
          onPress={() => {
            this.setState({ error: null });
            this.props.onReset?.();
          }}
          style={{
            marginTop: 24,
            paddingHorizontal: 20,
            paddingVertical: 12,
            backgroundColor: '#F59E0B',
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#0A0F1E', fontWeight: '700' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}
