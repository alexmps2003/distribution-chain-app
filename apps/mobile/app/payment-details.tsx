import { router, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppModal } from '../components/AppModal';
import {
  apiGet,
  getFriendlyError,
  type FriendlyError,
} from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

type MoneyValue = string | number;

type PaymentPart = {
  amount: MoneyValue;
  bankReference: string | null;
  cardReference: string | null;
  chequeBank: string | null;
  chequeDate: string | null;
  chequeNumber: string | null;
  id: string;
  method: string;
};

type PaymentAllocation = {
  amount: MoneyValue;
  id: string;
  invoice: {
    amount?: MoneyValue;
    id: string;
    invoiceNumber: string;
  } | null;
  paymentPart: PaymentPart | null;
  paymentPartId: string | null;
};

type PaymentDetailsResponse = {
  allocations: PaymentAllocation[];
  customer: {
    code: string;
    name: string;
  } | null;
  parts: PaymentPart[];
  payment: {
    amount: MoneyValue;
    id: string;
    paymentDate: string;
    paymentMethod: string;
    status?: string;
  };
  receiptReference?: string;
};

export default function PaymentDetailsScreen() {
  const { accessToken } = useAuth();
  const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();
  const [details, setDetails] = useState<PaymentDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [screenError, setScreenError] = useState<FriendlyError | null>(null);
  const [printModal, setPrintModal] = useState<{
    message: string;
    title: string;
  } | null>(null);

  const loadPayment = useCallback(
    async ({ refreshing = false }: { refreshing?: boolean } = {}) => {
      if (!paymentId) {
        setScreenError({ message: 'Payment is required.' });
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

        const response = await apiGet<PaymentDetailsResponse>(
          `/payments/${encodeURIComponent(paymentId)}`,
          accessToken ?? undefined,
        );

        setDetails(response);
      } catch (error) {
        setScreenError(
          getFriendlyError(error, 'Unable to load payment details right now.'),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken, paymentId],
  );

  useEffect(() => {
    void loadPayment();
  }, [loadPayment]);

  const paymentMethods = useMemo(() => {
    return (details?.parts ?? []).map((part) => ({
      ...part,
      allocations: (details?.allocations ?? []).filter((allocation) => {
        return allocation.paymentPart?.id === part.id || allocation.paymentPartId === part.id;
      }),
    }));
  }, [details]);

  const invoiceAllocations = useMemo(() => {
    const allocationsByInvoice = new Map<
      string,
      {
        amount: number;
        invoiceNumber: string;
        invoiceTotal?: MoneyValue;
      }
    >();

    for (const allocation of details?.allocations ?? []) {
      const invoiceNumber = allocation.invoice?.invoiceNumber ?? 'Invoice unavailable';
      const key = allocation.invoice?.id ?? allocation.id;
      const existing = allocationsByInvoice.get(key);

      allocationsByInvoice.set(key, {
        amount: (existing?.amount ?? 0) + Number(allocation.amount),
        invoiceNumber,
        invoiceTotal: allocation.invoice?.amount ?? existing?.invoiceTotal,
      });
    }

    return Array.from(allocationsByInvoice.values());
  }, [details]);

  const isInitialLoading = isLoading && !details;
  const paymentStatus = details?.payment.status ?? 'ACTIVE';
  const receiptReference = details
    ? details.receiptReference ?? formatPaymentReference(details.payment)
    : '-';

  function retryPayment() {
    void loadPayment();
  }

  function refreshPayment() {
    void loadPayment({ refreshing: true });
  }

  async function handlePrintReceipt() {
    if (!details) {
      return;
    }

    try {
      setIsGeneratingReceipt(true);

      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (!isSharingAvailable) {
        setPrintModal({
          title: 'Print Receipt',
          message: 'Sharing is not available on this device.',
        });
        return;
      }

      const html = buildReceiptHtml({
        details,
        generatedAt: new Date(),
        invoiceAllocations,
        paymentMethods,
        receiptReference,
        status: paymentStatus,
      });
      const pdf = await Print.printToFileAsync({ html });

      await Sharing.shareAsync(pdf.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      setPrintModal({
        title: 'Print Receipt',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to generate the receipt PDF. Please try again.',
      });
    } finally {
      setIsGeneratingReceipt(false);
    }
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
        <Text style={styles.kicker}>Payment Receipt</Text>
        <Text style={styles.title}>Payment Details</Text>
      </View>

      <ScrollView
        style={styles.detailList}
        contentContainerStyle={styles.detailListContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshPayment}
            tintColor="#0369a1"
          />
        }
      >
        {isInitialLoading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Loading payment details...</Text>
          </View>
        ) : screenError && !details ? (
          <ErrorCard error={screenError} onRetry={retryPayment} />
        ) : !details ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Payment not found.</Text>
          </View>
        ) : (
          <>
            {screenError ? (
              <ErrorCard error={screenError} onRetry={retryPayment} />
            ) : null}

            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryTitleBlock}>
                  <Text style={styles.receiptLabel}>Receipt number</Text>
                  <Text style={styles.receiptNumber}>{receiptReference}</Text>
                </View>
                <StatusBadge status={paymentStatus} />
              </View>

              <View style={styles.summaryGrid}>
                <DetailItem label="Customer" value={details.customer?.name ?? 'Customer unavailable'} />
                <DetailItem label="Code" value={details.customer?.code ?? 'Code unavailable'} />
                <DetailItem label="Payment Date" value={formatDateTime(details.payment.paymentDate)} />
                <DetailItem label="Total Amount" value={formatMoney(details.payment.amount)} />
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={[
                  styles.printButton,
                  isGeneratingReceipt ? styles.printButtonDisabled : null,
                ]}
                disabled={isGeneratingReceipt}
                onPress={handlePrintReceipt}
              >
                {isGeneratingReceipt ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.printButtonText}>Print Receipt</Text>
                )}
              </Pressable>
            </View>

            <Section title="Payment Method Summary">
              <Text style={styles.sectionValue}>
                {formatMethod(details.payment.paymentMethod)} -{' '}
                {formatMoney(details.payment.amount)}
              </Text>
            </Section>

            <Section title="Payment Method Details">
              {paymentMethods.length === 0 ? (
                <Text style={styles.mutedText}>No payment method details found.</Text>
              ) : (
                paymentMethods.map((part) => (
                  <View key={part.id} style={styles.methodCard}>
                    <View style={styles.methodHeader}>
                      <Text style={styles.methodName}>{formatMethod(part.method)}</Text>
                      <Text style={styles.methodAmount}>{formatMoney(part.amount)}</Text>
                    </View>

                    {getMethodDetails(part).map((detail) => (
                      <Text key={detail} style={styles.methodDetail}>
                        {detail}
                      </Text>
                    ))}

                    {part.allocations.length > 0 ? (
                      <View style={styles.methodAllocations}>
                        {part.allocations.map((allocation) => (
                          <Text key={allocation.id} style={styles.methodAllocationText}>
                            {allocation.invoice?.invoiceNumber ?? 'Invoice unavailable'}:{' '}
                            {formatMoney(allocation.amount)}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </Section>

            <Section title="Invoice Allocations">
              {invoiceAllocations.length === 0 ? (
                <Text style={styles.mutedText}>No invoice allocations found.</Text>
              ) : (
                invoiceAllocations.map((allocation) => (
                  <View key={allocation.invoiceNumber} style={styles.allocationRow}>
                    <View style={styles.allocationTextBlock}>
                      <Text style={styles.allocationInvoice}>
                        {allocation.invoiceNumber}
                      </Text>
                      <Text style={styles.allocationMeta}>
                        Invoice total{' '}
                        {allocation.invoiceTotal !== undefined
                          ? formatMoney(allocation.invoiceTotal)
                          : 'unavailable'}
                      </Text>
                    </View>
                    <Text style={styles.allocationAmount}>
                      {formatMoney(allocation.amount)}
                    </Text>
                  </View>
                ))
              )}
            </Section>
          </>
        )}
      </ScrollView>

      <AppModal
        visible={Boolean(printModal)}
        title={printModal?.title ?? 'Print Receipt'}
        message={printModal?.message ?? ''}
        primaryLabel="OK"
        onPrimaryPress={() => {
          setPrintModal(null);
        }}
      />
    </SafeAreaView>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <View style={[styles.statusBadge, getStatusBadgeStyle(status)]}>
      <Text style={[styles.statusBadgeText, getStatusBadgeTextStyle(status)]}>
        {formatStatus(status)}
      </Text>
    </View>
  );
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

function formatMoney(value: MoneyValue) {
  return `Rs. ${Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatPlainAmount(value: MoneyValue) {
  return Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMethod(method: string) {
  if (method === 'BANK_TRANSFER') {
    return 'Bank Transfer';
  }

  return method
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function formatStatus(status: string) {
  if (status === 'ACTIVE') {
    return 'Completed';
  }

  return formatMethod(status);
}

function formatPaymentReference(payment: { id: string; paymentDate: string }) {
  const datePart = new Date(payment.paymentDate)
    .toISOString()
    .slice(0, 10)
    .replaceAll('-', '');
  const idPart = payment.id.slice(-4).toUpperCase();

  return `PAY-${datePart}-${idPart}`;
}

function getMethodDetails(part: PaymentPart) {
  if (part.method === 'CHEQUE') {
    return [
      part.chequeNumber ? `Cheque ${part.chequeNumber}` : '',
      part.chequeBank ? `Bank: ${part.chequeBank}` : '',
      part.chequeDate ? `Cheque date: ${formatDate(part.chequeDate)}` : '',
    ].filter(Boolean);
  }

  if (part.method === 'BANK_TRANSFER') {
    return [part.bankReference ? `Reference: ${part.bankReference}` : 'Reference unavailable'];
  }

  if (part.method === 'CARD') {
    return [part.cardReference ? `Reference: ${part.cardReference}` : 'Reference unavailable'];
  }

  return ['Cash payment'];
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildReceiptHtml({
  details,
  generatedAt,
  invoiceAllocations,
  paymentMethods,
  receiptReference,
  status,
}: {
  details: PaymentDetailsResponse;
  generatedAt: Date;
  invoiceAllocations: {
    amount: number;
    invoiceNumber: string;
    invoiceTotal?: MoneyValue;
  }[];
  paymentMethods: (PaymentPart & { allocations: PaymentAllocation[] })[];
  receiptReference: string;
  status: string;
}) {
  const methodRows = paymentMethods.length
    ? paymentMethods
        .map((part) => {
          const detailsText = getMethodDetails(part)
            .map((detail) => escapeHtml(detail))
            .join('<br />');

          return `
            <tr>
              <td>${escapeHtml(formatMethod(part.method))}</td>
              <td class="right">Rs. ${escapeHtml(formatPlainAmount(part.amount))}</td>
              <td>${detailsText}</td>
            </tr>
          `;
        })
        .join('')
    : '<tr><td colspan="3">No payment method details found.</td></tr>';
  const allocationRows = invoiceAllocations.length
    ? invoiceAllocations
        .map((allocation) => {
          return `
            <tr>
              <td>${escapeHtml(allocation.invoiceNumber)}</td>
              <td class="right">${
                allocation.invoiceTotal !== undefined
                  ? `Rs. ${escapeHtml(formatPlainAmount(allocation.invoiceTotal))}`
                  : 'Unavailable'
              }</td>
              <td class="right">Rs. ${escapeHtml(formatPlainAmount(allocation.amount))}</td>
            </tr>
          `;
        })
        .join('')
    : '<tr><td colspan="3">No invoice allocations found.</td></tr>';

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            color: #111827;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 13px;
            line-height: 1.45;
            margin: 0;
            padding: 32px;
          }
          .brand {
            border-bottom: 3px solid #0369a1;
            margin-bottom: 24px;
            padding-bottom: 14px;
          }
          .brand-label {
            color: #0369a1;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          h1 {
            font-size: 26px;
            margin: 4px 0 0;
          }
          h2 {
            color: #0369a1;
            font-size: 15px;
            margin: 24px 0 10px;
          }
          .summary {
            border: 1px solid #dbeafe;
            border-radius: 12px;
            padding: 16px;
          }
          .grid {
            display: grid;
            gap: 12px 18px;
            grid-template-columns: 1fr 1fr;
          }
          .label {
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
          .value {
            font-size: 14px;
            font-weight: 700;
            margin-top: 3px;
          }
          .amount {
            color: #0369a1;
            font-size: 20px;
            font-weight: 900;
          }
          .status {
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            display: inline-block;
            font-size: 11px;
            font-weight: 800;
            margin-top: 5px;
            padding: 4px 9px;
            text-transform: uppercase;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th {
            background: #f8fafc;
            color: #475569;
            font-size: 10px;
            letter-spacing: 1px;
            text-align: left;
            text-transform: uppercase;
          }
          th,
          td {
            border-bottom: 1px solid #e2e8f0;
            padding: 9px 8px;
            vertical-align: top;
          }
          .right {
            text-align: right;
          }
          .generated {
            color: #64748b;
            font-size: 11px;
            margin-top: 28px;
          }
        </style>
      </head>
      <body>
        <div class="brand">
          <div class="brand-label">Distribio Collector</div>
          <h1>Payment Receipt</h1>
        </div>

        <div class="summary">
          <div class="grid">
            <div>
              <div class="label">Receipt Number</div>
              <div class="value">${escapeHtml(receiptReference)}</div>
            </div>
            <div>
              <div class="label">Status</div>
              <div class="status">${escapeHtml(formatStatus(status))}</div>
            </div>
            <div>
              <div class="label">Customer</div>
              <div class="value">${escapeHtml(details.customer?.name ?? 'Customer unavailable')}</div>
            </div>
            <div>
              <div class="label">Customer Code</div>
              <div class="value">${escapeHtml(details.customer?.code ?? 'Code unavailable')}</div>
            </div>
            <div>
              <div class="label">Payment Date</div>
              <div class="value">${escapeHtml(formatDateTime(details.payment.paymentDate))}</div>
            </div>
            <div>
              <div class="label">Total Amount</div>
              <div class="amount">Rs. ${escapeHtml(formatPlainAmount(details.payment.amount))}</div>
            </div>
          </div>
        </div>

        <h2>Payment Methods</h2>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th class="right">Amount</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>${methodRows}</tbody>
        </table>

        <h2>Invoice Allocations</h2>
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th class="right">Invoice Total</th>
              <th class="right">Allocated</th>
            </tr>
          </thead>
          <tbody>${allocationRows}</tbody>
        </table>

        <p class="generated">
          Generated ${escapeHtml(formatDateTime(generatedAt.toISOString()))}
        </p>
      </body>
    </html>
  `;
}

function getStatusBadgeStyle(status: string) {
  if (status === 'ACTIVE' || status === 'PAID') {
    return styles.statusBadgeSuccess;
  }

  if (status === 'REVERSED') {
    return styles.statusBadgeDanger;
  }

  return styles.statusBadgeNeutral;
}

function getStatusBadgeTextStyle(status: string) {
  if (status === 'ACTIVE' || status === 'PAID') {
    return styles.statusBadgeSuccessText;
  }

  if (status === 'REVERSED') {
    return styles.statusBadgeDangerText;
  }

  return styles.statusBadgeNeutralText;
}

const styles = StyleSheet.create({
  actionRow: {
    marginBottom: 16,
  },
  allocationAmount: {
    color: '#0369a1',
    fontSize: 16,
    fontWeight: '900',
  },
  allocationInvoice: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '900',
  },
  allocationMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  allocationRow: {
    alignItems: 'flex-start',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  allocationTextBlock: {
    flex: 1,
    paddingRight: 12,
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
  detailItem: {
    flex: 1,
    minWidth: '46%',
  },
  detailLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  detailList: {
    flex: 1,
  },
  detailListContent: {
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  detailValue: {
    color: '#020617',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: 5,
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
  methodAllocationText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  methodAllocations: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
  },
  methodAmount: {
    color: '#0369a1',
    fontSize: 16,
    fontWeight: '900',
  },
  methodCard: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    paddingTop: 14,
  },
  methodDetail: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 4,
  },
  methodHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  methodName: {
    color: '#020617',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    paddingRight: 12,
  },
  mutedText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  printButton: {
    alignItems: 'center',
    backgroundColor: '#020617',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  printButtonDisabled: {
    opacity: 0.7,
  },
  printButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  receiptLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  receiptNumber: {
    color: '#020617',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
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
  sectionCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginBottom: 16,
    padding: 18,
  },
  sectionTitle: {
    color: '#020617',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionValue: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
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
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statusBadgeDangerText: {
    color: '#b91c1c',
  },
  statusBadgeNeutral: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  statusBadgeNeutralText: {
    color: '#334155',
  },
  statusBadgeSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
  },
  statusBadgeSuccessText: {
    color: '#047857',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 18,
  },
  summaryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: '#020617',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
  },
});
