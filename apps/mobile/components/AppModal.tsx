import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type AppModalProps = {
  message: string;
  onPrimaryPress: () => void;
  primaryLabel: string;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  title: string;
  visible: boolean;
};

export function AppModal({
  message,
  onPrimaryPress,
  primaryLabel,
  secondaryLabel,
  onSecondaryPress,
  title,
  visible,
}: AppModalProps) {
  function closeModal() {
    if (onSecondaryPress) {
      onSecondaryPress();
      return;
    }

    onPrimaryPress();
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={closeModal}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {secondaryLabel && onSecondaryPress ? (
              <Pressable
                style={[styles.button, styles.secondaryButton]}
                onPress={onSecondaryPress}
              >
                <Text style={styles.secondaryButtonText}>
                  {secondaryLabel}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={onPrimaryPress}
            >
              <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 22,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    minWidth: 96,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    width: '100%',
  },
  message: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#0369a1',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '900',
  },
  title: {
    color: '#020617',
    fontSize: 20,
    fontWeight: '900',
  },
});
