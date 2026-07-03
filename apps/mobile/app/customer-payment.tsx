import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

type Customer = {
  code: string;
  id: string;
  name: string;
};

type Invoice = {
  amount: string | number;
  dueDate?: string | null;
  id: string;
  invoiceNumber: string;
  status: string;
};

type InvoiceRow = {
  displayStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  invoice: Invoice;
  outstanding: string | number;
};

type CustomerInvoicesResponse = {
  customer: Customer;
  invoices: InvoiceRow[];
};

export default function CustomerPaymentScreen() {
  const { accessToken } = useAuth();
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  const [data, setData] = useState<CustomerInvoicesResponse | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [allocationErrors, setAllocationErrors] = useState<
    Record<string, string>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadInvoices() {
      if (!customerId) {
        setErrorMessage('Customer is required.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await apiGet<CustomerInvoicesResponse>(
          `/invoices?customerId=${encodeURIComponent(customerId)}`,
          accessToken ?? undefined,
        );

        if (isMounted) {
          setData(response);
          setAllocations({});
          setAllocationErrors({});
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load invoices right now.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInvoices();

    return () => {
      isMounted = false;
    };
  }, [accessToken, customerId]);

  const openInvoices = useMemo(() => {
    return (data?.invoices ?? []).filter((invoice) => {
      return (
        invoice.displayStatus === 'UNPAID' ||
        invoice.displayStatus === 'PARTIALLY_PAID'
      );
    });
  }, [data]);

  const totalAllocatedCents = useMemo(() => {
    return openInvoices.reduce((total, invoice) => {
      return total + toCents(allocations[invoice.invoice.id] ?? '');
    }, 0);
  }, [allocations, openInvoices]);

  function updateAllocation(invoice: InvoiceRow, value: string) {
    const invoiceId = invoice.invoice.id;
    const parsedCents = parseAllocationInput(value);

    if (parsedCents === null) {
      setAllocationErrors((current) => ({
        ...current,
        [invoiceId]: 'Enter a valid amount.',
      }));
      return;
    }

    if (parsedCents < 0) {
      setAllocationErrors((current) => ({
        ...current,
        [invoiceId]: 'Allocation cannot be negative.',
      }));
      return;
    }

    if (parsedCents > toCents(invoice.outstanding)) {
      setAllocationErrors((current) => ({
        ...current,
        [invoiceId]: 'Allocation cannot exceed outstanding.',
      }));
      return;
    }

    setAllocationErrors((current) => {
      const next = { ...current };
      delete next[invoiceId];
      return next;
    });
    setAllocations((current) => ({
      ...current,
      [invoiceId]: value,
    }));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.kicker}>Record Payment</Text>
        <Text style={styles.title}>
          {data?.customer.name ?? 'Loading customer'}
        </Text>
        {data?.customer.code ? (
          <Text style={styles.subtitle}>{data.customer.code}</Text>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Loading invoices...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{errorMessage}</Text>
        </View>
      ) : openInvoices.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No unpaid invoices for this customer.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.invoiceList}
          contentContainerStyle={styles.invoiceListContent}
        >
          {openInvoices.map((invoice) => (
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

              <View style={styles.allocationBlock}>
                <Text style={styles.allocationLabel}>Allocation</Text>
                <TextInput
                  value={allocations[invoice.invoice.id] ?? ''}
                  onChangeText={(value) => {
                    updateAllocation(invoice, value);
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                  style={styles.allocationInput}
                />
                {allocationErrors[invoice.invoice.id] ? (
                  <Text style={styles.allocationError}>
                    {allocationErrors[invoice.invoice.id]}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Allocation Summary</Text>
            <Text style={styles.summaryLabel}>Total Allocated</Text>
            <Text style={styles.summaryValue}>
              {formatMoneyFromCents(totalAllocatedCents)}
            </Text>
          </View>
        </ScrollView>
      )}
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

function formatMoneyFromCents(value: number) {
  return `Rs. ${(value / 100).toLocaleString('en-US', {
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

function parseAllocationInput(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return 0;
  }

  if (trimmedValue.startsWith('-')) {
    return -1;
  }

  if (!/^\d*(\.\d{0,2})?$/.test(trimmedValue)) {
    return null;
  }

  return toCents(trimmedValue);
}

function toCents(value: string | number) {
  const text = String(value).trim();

  if (!text) {
    return 0;
  }

  const [wholePart, fractionPart = ''] = text.split('.');
  const wholeCents = Number(wholePart || '0') * 100;
  const fractionCents = Number(fractionPart.padEnd(2, '0').slice(0, 2));

  return wholeCents + fractionCents;
}

const styles = StyleSheet.create({
  allocationBlock: {
    marginTop: 18,
  },
  allocationError: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  allocationInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    color: '#020617',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  allocationLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
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
  invoiceList: {
    flex: 1,
  },
  invoiceListContent: {
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
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
  safeArea: {
    backgroundColor: '#f1f5f9',
    flex: 1,
  },
  status: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 14,
    textTransform: 'uppercase',
  },
  summaryTitle: {
    color: '#020617',
    fontSize: 20,
    fontWeight: '900',
  },
  summaryValue: {
    color: '#0369a1',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 6,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  title: {
    color: '#020617',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
  },
});
