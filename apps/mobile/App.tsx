import './global.css';

import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const summaryCards = [
  {
    label: 'Outstanding',
    value: 'Rs. 0.00',
  },
  {
    label: 'Collected Today',
    value: 'Rs. 0.00',
  },
  {
    label: 'Payments Today',
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
          <Text style={styles.title}>Collect Payment</Text>
          <Text style={styles.subtitle}>
            Search a customer, review outstanding invoices, enter payment
            methods, and allocate the payment before submitting.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.cardLabel}>Payment Workflow</Text>
          <Text style={styles.cardTitle}>Ready to record a collection</Text>
          <Text style={styles.cardText}>
            Start by selecting the customer, then match cash, cheque, or bank
            transfer amounts to the correct invoices.
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
            <Text style={styles.primaryButtonText}>Collect Payment</Text>
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
  heroCard: {
    backgroundColor: '#ffffff',
    borderColor: '#bae6fd',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 12,
    padding: 22,
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
    borderRadius: 24,
    marginBottom: 12,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
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
