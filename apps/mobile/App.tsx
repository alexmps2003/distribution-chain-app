import './global.css';

import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const summaryCards = [
  {
    label: 'Customers',
    value: '0',
  },
  {
    label: 'To Collect',
    value: 'Rs. 0.00',
  },
  {
    label: 'Completed',
    value: '0',
  },
];

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Distribio Collector</Text>
          <Text style={styles.title}>Today's Route</Text>
          <Text style={styles.subtitle}>
            Track customers, collections, and payment progress for today.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Route Status</Text>
          <Text style={styles.cardTitle}>No route assigned</Text>
          <Text style={styles.cardText}>
            Your assigned customers will appear here after login.
          </Text>
        </View>

        <View style={styles.summaryList}>
          {summaryCards.map((card) => (
            <View key={card.label} style={styles.card}>
              <Text style={styles.cardLabel}>{card.label}</Text>
              <Text style={styles.summaryValue}>{card.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Start Collections</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Search Customer</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    padding: 20,
  },
  cardLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardText: {
    color: '#64748b',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  cardTitle: {
    color: '#020617',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 12,
  },
  header: {
    marginBottom: 24,
  },
  kicker: {
    color: '#0369a1',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0369a1',
    borderRadius: 20,
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: '#f1f5f9',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  scrollView: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  secondaryButtonText: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  summaryList: {
    marginTop: 20,
  },
  summaryValue: {
    color: '#020617',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  title: {
    color: '#020617',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
  },
});
