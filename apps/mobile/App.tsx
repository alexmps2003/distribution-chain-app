import './global.css';

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet } from './lib/api-client';
import { useAuth } from './lib/auth-context';

type CollectorSummary = {
  collectedToday: string | number;
  paymentsToday: number;
  totalOutstanding: string | number;
};

export default function App() {
  const { accessToken, logout } = useAuth();
  const [summary, setSummary] = useState<CollectorSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        setIsLoadingSummary(true);

        const response = await apiGet<CollectorSummary>(
          '/dashboard/collector-summary',
          accessToken ?? undefined,
        );

        if (isMounted) {
          setSummary(response);
        }
      } catch (error) {
        if (isMounted) {
          setSummary(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSummary(false);
        }
      }
    }

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const summaryCards = useMemo(
    () => [
      {
        label: 'Outstanding',
        value: getSummaryValue(summary?.totalOutstanding, isLoadingSummary),
      },
      {
        label: 'Collected Today',
        value: getSummaryValue(summary?.collectedToday, isLoadingSummary),
      },
      {
        label: 'Payments Today',
        value: isLoadingSummary
          ? '...'
          : summary?.paymentsToday !== undefined
            ? String(summary.paymentsToday)
            : 'Unavailable',
      },
    ],
    [isLoadingSummary, summary],
  );

  function confirmLogout() {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      {
        style: 'cancel',
        text: 'Cancel',
      },
      {
        onPress: logout,
        style: 'destructive',
        text: 'Logout',
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.kicker}>Distribio Collector</Text>
            <Pressable style={styles.logoutButton} onPress={confirmLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>Collect Payment</Text>
          <Text style={styles.subtitle}>
            Select a customer and record today&apos;s payment.
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
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              router.push('/search-customer');
            }}
          >
            <Text style={styles.primaryButtonText}>Collect Payment</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              router.push('/customers');
            }}
          >
            <Text style={styles.secondaryButtonText}>Customers</Text>
          </Pressable>

          <Pressable
            style={styles.tertiaryButton}
            onPress={() => {
              router.push('/recent-payments');
            }}
          >
            <Text style={styles.tertiaryButtonText}>Recent Payments</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getSummaryValue(
  value: string | number | null | undefined,
  isLoading: boolean,
) {
  if (isLoading) {
    return '...';
  }

  if (value === null || value === undefined) {
    return 'Unavailable';
  }

  return `Rs. ${Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 'auto',
    paddingTop: 28,
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
  header: {
    marginBottom: 20,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: {
    color: '#0369a1',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingRight: 12,
    textTransform: 'uppercase',
  },
  logoutButton: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0369a1',
    borderRadius: 28,
    marginBottom: 12,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#f1f5f9',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 56,
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
    marginTop: 6,
  },
  summaryList: {
    marginTop: 0,
  },
  summaryValue: {
    color: '#020617',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  tertiaryButton: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  tertiaryButtonText: {
    color: '#0369a1',
    fontSize: 15,
    fontWeight: '900',
  },
  title: {
    color: '#020617',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
  },
});
