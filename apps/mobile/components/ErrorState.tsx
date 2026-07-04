import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FriendlyError } from '../lib/api-client';

type ErrorStateProps = {
  error: FriendlyError | string;
  onRetry?: () => void;
};

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const message = typeof error === 'string' ? error : error.message;
  const detail = typeof error === 'string' ? undefined : error.detail;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{message}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {onRetry ? (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  detail: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#020617',
    borderRadius: 14,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  title: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
});
