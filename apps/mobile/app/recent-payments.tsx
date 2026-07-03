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
import {
  apiGet,
  getFriendlyError,
  type FriendlyError,
} from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

type PaymentMethod = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'CARD' | 'MIXED';

type PaymentPart = {
  amount: string | number;
  method: PaymentMethod;
};

type PaymentAllocation = {
  amount: string | number;
  invoiceId: string;
};

type PaymentRow = {
  allocations?: PaymentAllocation[];
  amount: string | number;
  customer?: {
    code: string;
    name: string;
  } | null;
  id: string;
  parts?: PaymentPart[];
  paymentDate: string;
  paymentMethod?: PaymentMethod;
};

export default function RecentPaymentsScreen() {
  const { accessToken } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [screenError, setScreenError] = useState<FriendlyError | null>(null);

  const loadPayments = useCallback(
    async ({ refreshing = false }: { refreshing?: boolean } = {}) => {
      try {
        if (refreshing) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setScreenError(null);

        const response = await apiGet<PaymentRow[]>(
          '/payments',
          accessToken ?? undefined,
        );

        setPayments(response);
      } catch (error) {
        setScreenError(
          getFriendlyError(error, 'Unable to load recent payments right now.'),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const recentPayments = useMemo(() => payments.slice(0, 20), [payments]);
  const isInitialLoading = isLoading && payments.length === 0;

  function retryPayments() {
    void loadPayments();
  }

  function refreshPayments() {
    void loadPayments({ refreshing: true });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            router.back();
          }}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.kicker}>Distribio Collector</Text>
        <Text style={styles.title}>Recent Payments</Text>
      </View>

      <ScrollView
        style={styles.paymentList}
        contentContainerStyle={styles.paymentListContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshPayments}
            tintColor="#0369a1"
          />
        }
      >
        {isInitialLoading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Loading recent payments...</Text>
          </View>
        ) : screenError && payments.length === 0 ? (
          <ErrorCard error={screenError} onRetry={retryPayments} />
        ) : recentPayments.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>No payments recorded yet.</Text>
          </View>
        ) : (
          <>
            {screenError ? (
              <ErrorCard error={screenError} onRetry={retryPayments} />
            ) : null}
            {recentPayments.map((payment) => (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <View style={styles.customerBlock}>
                    <Text style={styles.customerName}>
                      {payment.customer?.name ?? 'Customer unavailable'}
                    </Text>
                    {payment.customer?.code ? (
                      <Text style={styles.customerCode}>
                        {payment.customer.code}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.amount}>
                    {formatMoney(payment.amount)}
                  </Text>
                </View>

                <Text style={styles.paymentDate}>
                  {formatDateTime(payment.paymentDate)}
                </Text>

                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Methods</Text>
                  <Text style={styles.detailValue}>
                    {formatMethodSummary(payment)}
                  </Text>
                </View>

                {payment.allocations ? (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Invoice Allocations</Text>
                    <Text style={styles.detailValue}>
                      {formatAllocationSummary(payment.allocations)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatMoney(value: string | number) {
  return `Rs. ${Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMethodSummary(payment: PaymentRow) {
  const parts = payment.parts ?? [];

  if (parts.length === 0) {
    return getMethodLabel(payment.paymentMethod ?? 'MIXED');
  }

  return parts
    .map((part) => `${getMethodLabel(part.method)} ${formatMoney(part.amount)}`)
    .join(' + ');
}

function formatAllocationSummary(allocations: PaymentAllocation[]) {
  if (allocations.length === 0) {
    return 'No invoice allocations returned';
  }

  const total = allocations.reduce((sum, allocation) => {
    return sum + Number(allocation.amount);
  }, 0);
  const label = allocations.length === 1 ? 'allocation' : 'allocations';

  return `${allocations.length} invoice ${label} - ${formatMoney(total)}`;
}

function getMethodLabel(method: PaymentMethod) {
  if (method === 'BANK_TRANSFER') {
    return 'Bank Transfer';
  }

  if (method === 'MIXED') {
    return 'Mixed';
  }

  return method.charAt(0) + method.slice(1).toLowerCase();
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
  amount: {
    color: '#0369a1',
    fontSize: 17,
    fontWeight: '900',
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
  },
  customerBlock: {
    flex: 1,
    paddingRight: 12,
  },
  customerCode: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  customerName: {
    color: '#020617',
    fontSize: 19,
    fontWeight: '900',
  },
  detailBlock: {
    marginTop: 14,
  },
  detailLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 4,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 4,
    padding: 20,
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  kicker: {
    color: '#0369a1',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  paymentCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  paymentDate: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  paymentHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentList: {
    flex: 1,
  },
  paymentListContent: {
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
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
  safeArea: {
    backgroundColor: '#f1f5f9',
    flex: 1,
  },
  stateCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
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
  title: {
    color: '#020617',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
  },
});
