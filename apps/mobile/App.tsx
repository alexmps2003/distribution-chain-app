import './global.css';

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppModal } from './components/AppModal';
import { BrandHeader } from './components/BrandHeader';
import { apiGet, getFriendlyError, type FriendlyError } from './lib/api-client';
import { useAuth } from './lib/auth-context';

type CollectorSummary = {
  collectedToday: string | number;
  paymentsToday: number;
  totalOutstanding: string | number;
};

export default function App() {
  const { accessToken, logout, user } = useAuth();
  const [summary, setSummary] = useState<CollectorSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summaryError, setSummaryError] = useState<FriendlyError | null>(null);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const loadSummary = useCallback(
    async ({ refreshing = false }: { refreshing?: boolean } = {}) => {
      try {
        if (refreshing) {
          setIsRefreshing(true);
        } else {
          setIsLoadingSummary(true);
        }
        setSummaryError(null);

        const response = await apiGet<CollectorSummary>(
          '/dashboard/collector-summary',
          accessToken ?? undefined,
        );

        setSummary(response);
        setLastSyncedAt(new Date());
      } catch (error) {
        setSummaryError(
          getFriendlyError(error, 'Unable to load dashboard right now.'),
        );
      } finally {
        setIsLoadingSummary(false);
        setIsRefreshing(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const isInitialLoading = isLoadingSummary && !summary;
  const headerMetadata = getHeaderMetadata({
    collectorName: user?.name,
    lastSyncedAt,
  });

  const summaryCards = useMemo(
    () => [
      {
        label: 'Outstanding',
        value: getSummaryValue(summary?.totalOutstanding, isInitialLoading),
      },
      {
        label: 'Collected Today',
        value: getSummaryValue(summary?.collectedToday, isInitialLoading),
      },
      {
        label: 'Payments Today',
        value: isInitialLoading
          ? '...'
          : summary?.paymentsToday !== undefined
            ? String(summary.paymentsToday)
            : 'Unavailable',
      },
    ],
    [isInitialLoading, summary],
  );

  function retrySummary() {
    void loadSummary();
  }

  function refreshSummary() {
    void loadSummary({ refreshing: true });
  }

  function confirmLogout() {
    setIsLogoutModalVisible(true);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshSummary}
            tintColor="#0369a1"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandHeaderWrap}>
              <BrandHeader />
            </View>
            <Pressable style={styles.logoutButton} onPress={confirmLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>Collect Payment</Text>
          <Text style={styles.subtitle}>
            Select a customer and record today&apos;s payment.
          </Text>
          <Text style={styles.metadata}>{headerMetadata}</Text>
        </View>

        <View style={styles.summaryList}>
          {isInitialLoading ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateText}>Loading dashboard...</Text>
            </View>
          ) : summaryError && !summary ? (
            <ErrorCard error={summaryError} onRetry={retrySummary} />
          ) : (
            <>
              {summaryError ? (
                <ErrorCard error={summaryError} onRetry={retrySummary} />
              ) : null}
              {summaryCards.map((card) => (
                <View key={card.label} style={styles.card}>
                  <Text style={styles.cardLabel}>{card.label}</Text>
                  <Text style={styles.summaryValue}>{card.value}</Text>
                </View>
              ))}
            </>
          )}
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

      <AppModal
        visible={isLogoutModalVisible}
        title="Logout"
        message="Are you sure you want to log out?"
        primaryLabel="Logout"
        onPrimaryPress={() => {
          setIsLogoutModalVisible(false);
          logout();
        }}
        secondaryLabel="Cancel"
        onSecondaryPress={() => {
          setIsLogoutModalVisible(false);
        }}
      />
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

function getHeaderMetadata({
  collectorName,
  lastSyncedAt,
}: {
  collectorName?: string;
  lastSyncedAt: Date | null;
}) {
  return [
    formatTodayLabel(),
    collectorName?.trim() || '',
    formatLastSynced(lastSyncedAt),
  ]
    .filter(Boolean)
    .join(' • ');
}

function formatTodayLabel() {
  return new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });
}

function formatLastSynced(lastSyncedAt: Date | null) {
  if (!lastSyncedAt) {
    return 'Not updated yet';
  }

  const elapsedMinutes = Math.floor(
    (Date.now() - lastSyncedAt.getTime()) / 60000,
  );

  if (elapsedMinutes <= 0) {
    return 'Updated just now';
  }

  if (elapsedMinutes === 1) {
    return 'Updated 1 min ago';
  }

  return `Updated ${elapsedMinutes} min ago`;
}

function ErrorCard({
  error,
  onRetry,
}: {
  error: FriendlyError;
  onRetry: () => void;
}) {
  return (
    <View style={styles.stateCard}>
      <Text style={styles.stateText}>{error.message}</Text>
      {error.detail ? (
        <Text style={styles.stateDetail}>{error.detail}</Text>
      ) : null}
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
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
  brandHeaderWrap: {
    flex: 1,
    paddingRight: 12,
  },
  header: {
    marginBottom: 20,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  metadata: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 8,
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
  subtitle: {
    color: '#64748b',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 6,
  },
  stateCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    padding: 20,
  },
  stateDetail: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 8,
  },
  stateText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
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
