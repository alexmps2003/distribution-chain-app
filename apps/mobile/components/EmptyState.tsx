import { StyleSheet, Text, View } from 'react-native';

type EmptyStateProps = {
  description?: string;
  title: string;
  variant?: 'card' | 'inline';
};

export function EmptyState({
  description,
  title,
  variant = 'card',
}: EmptyStateProps) {
  return (
    <View style={variant === 'inline' ? styles.inline : styles.card}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
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
  description: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 8,
  },
  inline: {
    paddingVertical: 2,
  },
  title: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
});
