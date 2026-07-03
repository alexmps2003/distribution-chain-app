import { router, useLocalSearchParams } from 'expo-router';
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

type Customer = {
  code: string;
  id: string;
  name: string;
  routeName?: string | null;
};

type Invoice = {
  amount: string | number;
  dueDate?: string | null;
  id: string;
  invoiceNumber: string;
};

type InvoiceRow = {
  activePaidAmount: string | number;
  displayStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  invoice: Invoice;
  outstanding: string | number;
};

type CustomerInvoicesResponse = {
  customer: Customer;
  invoices: InvoiceRow[];
};

export default function CustomerDetailsScreen() {
  const { accessToken } = useAuth();
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  const [data, setData] = useState<CustomerInvoicesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [screenError, setScreenError] = useState<FriendlyError | null>(null);

  const loadCustomerInvoices = useCallback(
    async ({ refreshing = false }: { refreshing?: boolean } = {}) => {
      if (!customerId) {
        setScreenError({ message: 'Customer is required.' });
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        if (refreshing) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setScreenError(null);

        const response = await apiGet<CustomerInvoicesResponse>(
          `/invoices?customerId=${encodeURIComponent(customerId)}`,
          accessToken ?? undefined,
        );

        setData(response);
      } catch (error) {
        setScreenError(
          getFriendlyError(error, 'Unable to load invoices right now.'),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken, customerId],
  );

  useEffect(() => {
    void loadCustomerInvoices();
  }, [loadCustomerInvoices]);

  const openInvoices = useMemo(() => {
    return (data?.invoices ?? []).filter((invoice) => {
      return (
        invoice.displayStatus === 'UNPAID' ||
        invoice.displayStatus === 'PARTIALLY_PAID'
      );
    });
  }, [data]);

  const totalOutstanding = useMemo(() => {
    return openInvoices.reduce((total, invoice) => {
      return total + Number(invoice.outstanding);
    }, 0);
  }, [openInvoices]);

  const isInitialLoading = isLoading && !data;

  function retryCustomerInvoices() {
    void loadCustomerInvoices();
  }

  function refreshCustomerInvoices() {
    void loadCustomerInvoices({ refreshing: true });
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
        <Text style={styles.kicker}>Customer Details</Text>
        <Text style={styles.title}>{data?.customer.name ?? 'Customer'}</Text>
        {data?.customer.code ? (
          <Text style={styles.subtitle}>{data.customer.code}</Text>
        ) : null}
      </View>

      <ScrollView
        style={styles.detailList}
        contentContainerStyle={styles.detailListContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshCustomerInvoices}
            tintColor="#0369a1"
          />
        }
      >
        {isInitialLoading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Loading invoices...</Text>
          </View>
        ) : screenError && !data ? (
          <ErrorCard error={screenError} onRetry={retryCustomerInvoices} />
        ) : !data ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Customer not found.</Text>
          </View>
        ) : (
          <>
            {screenError ? (
              <ErrorCard
                error={screenError}
                onRetry={retryCustomerInvoices}
              />
            ) : null}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Route</Text>
              <Text style={styles.summaryValue}>
                {data.customer.routeName?.trim() || 'Route unavailable'}
              </Text>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryBlock}>
                  <Text style={styles.summaryLabel}>Outstanding</Text>
                  <Text style={styles.summaryNumber}>
                    {formatMoney(totalOutstanding)}
                  </Text>
                </View>
                <View style={styles.summaryBlock}>
                  <Text style={styles.summaryLabel}>Open Invoices</Text>
                  <Text style={styles.summaryNumber}>
                    {String(openInvoices.length)}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Unpaid Invoices</Text>

            {openInvoices.length === 0 ? (
              <View style={styles.emptyStateInline}>
                <Text style={styles.emptyStateText}>
                  No unpaid invoices for this customer.
                </Text>
              </View>
            ) : (
              openInvoices.map((invoice) => (
                <View key={invoice.invoice.id} style={styles.invoiceCard}>
                  <View style={styles.invoiceHeader}>
                    <Text style={styles.invoiceNumber}>
                      {invoice.invoice.invoiceNumber}
                    </Text>
                    <Text style={styles.status}>{formatStatus(invoice)}</Text>
                  </View>

                  <Text style={styles.invoiceMeta}>
                    Due {formatDate(invoice.invoice.dueDate)}
                  </Text>

                  <View style={styles.amountRow}>
                    <View style={styles.amountBlock}>
                      <Text style={styles.amountLabel}>Invoice Total</Text>
                      <Text style={styles.amountValue}>
                        {formatMoney(invoice.invoice.amount)}
                      </Text>
                    </View>
                    <View style={styles.amountBlock}>
                      <Text style={styles.amountLabel}>Outstanding</Text>
                      <Text style={styles.outstandingValue}>
                        {formatMoney(invoice.outstanding)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(value: string | number) {
  return `Rs. ${Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatStatus(invoice: InvoiceRow) {
  if (invoice.displayStatus === 'PARTIALLY_PAID') {
    return 'Partially paid';
  }

  return 'Unpaid';
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
  amountBlock: {
    flex: 1,
  },
  amountLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  amountRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  amountValue: {
    color: '#020617',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
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
  detailList: {
    flex: 1,
  },
  detailListContent: {
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
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
  emptyStateInline: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
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
  invoiceCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  invoiceHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  invoiceMeta: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  invoiceNumber: {
    color: '#020617',
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    paddingRight: 12,
  },
  kicker: {
    color: '#0369a1',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  outstandingValue: {
    color: '#0369a1',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
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
  sectionTitle: {
    color: '#020617',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
    marginTop: 22,
  },
  status: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
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
  subtitle: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  summaryBlock: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 18,
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryNumber: {
    color: '#0369a1',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 6,
  },
  summaryValue: {
    color: '#020617',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
  },
  title: {
    color: '#020617',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
  },
});
