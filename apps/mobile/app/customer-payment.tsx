import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
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

type PaymentMethod = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'CARD';

type MethodDraft = {
  amount: string;
  bankReference: string;
  bankTransferBank: string;
  cardReference: string;
  chequeBank: string;
  chequeDate: string;
  chequeNumber: string;
};

type AddedMethod = {
  amount: string;
  bankReference?: string;
  bankTransferBank?: string;
  cardReference?: string;
  chequeBank?: string;
  chequeDate?: string;
  chequeNumber?: string;
  details: string;
  method: PaymentMethod;
};

const paymentMethods: { id: PaymentMethod; label: string }[] = [
  { id: 'CASH', label: 'Cash' },
  { id: 'CHEQUE', label: 'Cheque' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { id: 'CARD', label: 'Card' },
];

const emptyMethodDraft: MethodDraft = {
  amount: '',
  bankReference: '',
  bankTransferBank: '',
  cardReference: '',
  chequeBank: '',
  chequeDate: '',
  chequeNumber: '',
};

function createInitialMethodDrafts(): Record<PaymentMethod, MethodDraft> {
  return {
    BANK_TRANSFER: { ...emptyMethodDraft },
    CARD: { ...emptyMethodDraft },
    CASH: { ...emptyMethodDraft },
    CHEQUE: { ...emptyMethodDraft },
  };
}

export default function CustomerPaymentScreen() {
  const { accessToken } = useAuth();
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const invoiceLayouts = useRef<Record<string, { y: number }>>({});
  const [data, setData] = useState<CustomerInvoicesResponse | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH');
  const [methodDrafts, setMethodDrafts] = useState<
    Record<PaymentMethod, MethodDraft>
  >(createInitialMethodDrafts);
  const [addedMethods, setAddedMethods] = useState<AddedMethod[]>([]);
  const [isChequeDatePickerOpen, setIsChequeDatePickerOpen] = useState(false);
  const [methodMessage, setMethodMessage] = useState('');
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
          setMethodDrafts(createInitialMethodDrafts());
          setAddedMethods([]);
          setIsChequeDatePickerOpen(false);
          setMethodMessage('');
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
    const sanitizedValue = sanitizeAllocationInput(value);
    const outstandingCents = toCents(invoice.outstanding);
    const allocationCents = toCents(sanitizedValue);
    const nextValue =
      allocationCents > outstandingCents
        ? formatInputFromCents(outstandingCents)
        : sanitizedValue;

    setAllocations((current) => ({
      ...current,
      [invoiceId]: nextValue,
    }));
  }

  function updateMethodDraft(field: keyof MethodDraft, value: string) {
    const nextValue = field === 'amount' ? sanitizeAllocationInput(value) : value;

    setMethodDrafts((current) => ({
      ...current,
      [selectedMethod]: {
        ...current[selectedMethod],
        [field]: nextValue,
      },
    }));
  }

  function addMethod() {
    const draft = methodDrafts[selectedMethod];
    const amountCents = toCents(draft.amount);

    if (amountCents <= 0) {
      setMethodMessage('Method amount must be greater than 0.');
      return;
    }

    if (selectedMethod === 'CHEQUE') {
      if (!draft.chequeNumber.trim()) {
        setMethodMessage('Cheque number is required.');
        return;
      }

      if (!draft.chequeBank.trim()) {
        setMethodMessage('Cheque bank is required.');
        return;
      }

      if (!draft.chequeDate.trim()) {
        setMethodMessage('Cheque date is required.');
        return;
      }
    }

    if (selectedMethod === 'BANK_TRANSFER') {
      if (!draft.bankReference.trim()) {
        setMethodMessage('Reference number is required.');
        return;
      }

      if (!draft.bankTransferBank.trim()) {
        setMethodMessage('Bank is required.');
        return;
      }
    }

    if (selectedMethod === 'CARD' && !draft.cardReference.trim()) {
      setMethodMessage('Reference number is required.');
      return;
    }

    const addedMethod: AddedMethod = {
      method: selectedMethod,
      amount: formatInputFromCents(amountCents),
      details: getMethodDetails(selectedMethod, draft),
      chequeNumber:
        selectedMethod === 'CHEQUE' ? draft.chequeNumber.trim() : undefined,
      chequeBank:
        selectedMethod === 'CHEQUE' ? draft.chequeBank.trim() : undefined,
      chequeDate:
        selectedMethod === 'CHEQUE' ? draft.chequeDate.trim() : undefined,
      bankReference:
        selectedMethod === 'BANK_TRANSFER'
          ? draft.bankReference.trim()
          : undefined,
      bankTransferBank:
        selectedMethod === 'BANK_TRANSFER'
          ? draft.bankTransferBank.trim()
          : undefined,
      cardReference:
        selectedMethod === 'CARD' ? draft.cardReference.trim() : undefined,
    };

    setAddedMethods((current) => [...current, addedMethod]);
    setMethodDrafts((current) => ({
      ...current,
      [selectedMethod]: { ...emptyMethodDraft },
    }));
    setIsChequeDatePickerOpen(false);
    setMethodMessage('');
  }

  function updateChequeDate(
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) {
    if (Platform.OS === 'android') {
      setIsChequeDatePickerOpen(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    updateMethodDraft('chequeDate', formatDateInput(selectedDate));
  }

  function scrollToInvoice(invoiceId: string) {
    const invoiceLayout = invoiceLayouts.current[invoiceId];

    if (!invoiceLayout) {
      return;
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        animated: true,
        y: Math.max(invoiceLayout.y - 20, 0),
      });
    }, 250);
  }

  const selectedMethodDraft = methodDrafts[selectedMethod];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.screenContent}>
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
                ref={scrollViewRef}
                style={styles.invoiceList}
                contentContainerStyle={styles.invoiceListContent}
                keyboardDismissMode={
                  Platform.OS === 'ios' ? 'interactive' : 'on-drag'
                }
                keyboardShouldPersistTaps="handled"
              >
                {openInvoices.map((invoice) => (
                  <View
                    key={invoice.invoice.id}
                    style={styles.invoiceCard}
                    onLayout={(event) => {
                      invoiceLayouts.current[invoice.invoice.id] = {
                        y: event.nativeEvent.layout.y,
                      };
                    }}
                  >
                    <View style={styles.invoiceHeader}>
                      <Text style={styles.invoiceNumber}>
                        {invoice.invoice.invoiceNumber}
                      </Text>
                      <Text style={styles.status}>
                        {formatStatus(invoice)}
                      </Text>
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
                        onFocus={() => {
                          scrollToInvoice(invoice.invoice.id);
                        }}
                        placeholder="0.00"
                        placeholderTextColor="#94a3b8"
                        keyboardType="decimal-pad"
                        style={styles.allocationInput}
                      />
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

                <View style={styles.paymentMethodsSection}>
                  <Text style={styles.sectionTitle}>Payment Methods</Text>

                  <View style={styles.methodButtonGrid}>
                    {paymentMethods.map((method) => {
                      const isSelected = selectedMethod === method.id;

                      return (
                        <Pressable
                          key={method.id}
                          onPress={() => {
                            setSelectedMethod(method.id);
                            setIsChequeDatePickerOpen(false);
                            setMethodMessage('');
                          }}
                          style={[
                            styles.methodButton,
                            isSelected ? styles.methodButtonSelected : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.methodButtonText,
                              isSelected
                                ? styles.methodButtonTextSelected
                                : null,
                            ]}
                          >
                            {method.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.methodFormCard}>
                    <PaymentField
                      label="Amount"
                      keyboardType="decimal-pad"
                      value={selectedMethodDraft.amount}
                      onChangeText={(value) => {
                        updateMethodDraft('amount', value);
                      }}
                    />

                    {selectedMethod === 'CHEQUE' ? (
                      <>
                        <PaymentField
                          label="Cheque Number"
                          value={selectedMethodDraft.chequeNumber}
                          onChangeText={(value) => {
                            updateMethodDraft('chequeNumber', value);
                          }}
                        />
                        <PaymentField
                          label="Bank"
                          value={selectedMethodDraft.chequeBank}
                          onChangeText={(value) => {
                            updateMethodDraft('chequeBank', value);
                          }}
                        />
                        <ChequeDateField
                          value={selectedMethodDraft.chequeDate}
                          onPress={() => {
                            Keyboard.dismiss();
                            setIsChequeDatePickerOpen(true);
                          }}
                        />
                        {isChequeDatePickerOpen ? (
                          <DateTimePicker
                            value={getDatePickerValue(
                              selectedMethodDraft.chequeDate,
                            )}
                            mode="date"
                            display={
                              Platform.OS === 'ios' ? 'spinner' : 'default'
                            }
                            onChange={updateChequeDate}
                          />
                        ) : null}
                      </>
                    ) : null}

                    {selectedMethod === 'BANK_TRANSFER' ? (
                      <>
                        <PaymentField
                          label="Reference Number"
                          value={selectedMethodDraft.bankReference}
                          onChangeText={(value) => {
                            updateMethodDraft('bankReference', value);
                          }}
                        />
                        <PaymentField
                          label="Bank"
                          value={selectedMethodDraft.bankTransferBank}
                          onChangeText={(value) => {
                            updateMethodDraft('bankTransferBank', value);
                          }}
                        />
                      </>
                    ) : null}

                    {selectedMethod === 'CARD' ? (
                      <PaymentField
                        label="Reference Number"
                        value={selectedMethodDraft.cardReference}
                        onChangeText={(value) => {
                          updateMethodDraft('cardReference', value);
                        }}
                      />
                    ) : null}
                  </View>

                  {methodMessage ? (
                    <Text style={styles.methodMessage}>{methodMessage}</Text>
                  ) : null}

                  <Pressable style={styles.addMethodButton} onPress={addMethod}>
                    <Text style={styles.addMethodButtonText}>Add Method</Text>
                  </Pressable>

                  <View style={styles.methodsAddedSection}>
                    <Text style={styles.sectionTitle}>Methods Added</Text>
                    {addedMethods.length === 0 ? (
                      <View style={styles.emptyMethodsCard}>
                        <Text style={styles.emptyStateText}>
                          No methods added yet.
                        </Text>
                      </View>
                    ) : (
                      addedMethods.map((method, index) => (
                        <View
                          key={`${method.method}-${index}`}
                          style={styles.addedMethodCard}
                        >
                          <View style={styles.addedMethodHeader}>
                            <Text style={styles.addedMethodName}>
                              {getMethodLabel(method.method)}
                            </Text>
                            <Text style={styles.addedMethodAmount}>
                              {formatMoney(method.amount)}
                            </Text>
                          </View>
                          <Text style={styles.addedMethodDetails}>
                            {method.details || '-'}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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

function getMethodLabel(method: PaymentMethod) {
  return paymentMethods.find((item) => item.id === method)?.label ?? method;
}

function getMethodDetails(method: PaymentMethod, draft: MethodDraft) {
  if (method === 'CHEQUE') {
    return [
      draft.chequeNumber.trim() ? `Cheque ${draft.chequeNumber.trim()}` : '',
      draft.chequeBank.trim(),
      draft.chequeDate.trim(),
    ]
      .filter(Boolean)
      .join(' - ');
  }

  if (method === 'BANK_TRANSFER') {
    return [
      draft.bankReference.trim() ? `Ref ${draft.bankReference.trim()}` : '',
      draft.bankTransferBank.trim(),
    ]
      .filter(Boolean)
      .join(' - ');
  }

  if (method === 'CARD') {
    return draft.cardReference.trim()
      ? `Ref ${draft.cardReference.trim()}`
      : '';
  }

  return '';
}

function ChequeDateField({
  onPress,
  value,
}: {
  onPress: () => void;
  value: string;
}) {
  return (
    <View style={styles.paymentField}>
      <Text style={styles.paymentFieldLabel}>Cheque Date</Text>
      <Pressable style={styles.chequeDateButton} onPress={onPress}>
        <Text
          style={
            value ? styles.chequeDateValue : styles.chequeDatePlaceholder
          }
        >
          {value || 'Select cheque date'}
        </Text>
      </Pressable>
    </View>
  );
}

function PaymentField({
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  value,
}: {
  keyboardType?: 'default' | 'decimal-pad';
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={styles.paymentField}>
      <Text style={styles.paymentFieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        style={[
          styles.paymentFieldInput,
          keyboardType === 'decimal-pad' ? styles.paymentFieldInputAmount : null,
        ]}
      />
    </View>
  );
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDatePickerValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  if (year && month && day) {
    return new Date(year, month - 1, day);
  }

  return new Date();
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

function sanitizeAllocationInput(value: string) {
  let hasDecimal = false;
  let wholePart = '';
  let fractionPart = '';

  for (const character of value.trim()) {
    if (character >= '0' && character <= '9') {
      if (hasDecimal) {
        fractionPart = `${fractionPart}${character}`.slice(0, 2);
      } else {
        wholePart = `${wholePart}${character}`;
      }
      continue;
    }

    if (character === '.' && !hasDecimal) {
      hasDecimal = true;
    }
  }

  if (!wholePart && !hasDecimal) {
    return '';
  }

  if (hasDecimal) {
    return `${wholePart}.${fractionPart}`;
  }

  return wholePart;
}

function formatInputFromCents(value: number) {
  return (value / 100).toFixed(2);
}

const styles = StyleSheet.create({
  addMethodButton: {
    alignItems: 'center',
    backgroundColor: '#020617',
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 15,
  },
  addMethodButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  addedMethodAmount: {
    color: '#0369a1',
    fontSize: 16,
    fontWeight: '900',
  },
  addedMethodCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  addedMethodDetails: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  addedMethodHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  addedMethodName: {
    color: '#020617',
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    paddingRight: 12,
  },
  allocationBlock: {
    marginTop: 18,
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
    textAlign: 'right',
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
  chequeDateButton: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chequeDatePlaceholder: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  chequeDateValue: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '700',
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
  emptyMethodsCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: 18,
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
    paddingBottom: 120,
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
  keyboardAvoidingView: {
    flex: 1,
  },
  methodButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  methodButtonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  methodButtonSelected: {
    backgroundColor: '#020617',
    borderColor: '#020617',
  },
  methodButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  methodButtonTextSelected: {
    color: '#ffffff',
  },
  methodFormCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginTop: 14,
    padding: 18,
  },
  methodMessage: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
  },
  methodsAddedSection: {
    gap: 12,
    marginTop: 22,
  },
  outstandingValue: {
    color: '#0369a1',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  paymentField: {
    gap: 8,
  },
  paymentFieldInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    color: '#020617',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  paymentFieldInputAmount: {
    textAlign: 'right',
  },
  paymentFieldLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  paymentMethodsSection: {
    marginTop: 24,
  },
  safeArea: {
    backgroundColor: '#f1f5f9',
    flex: 1,
  },
  screenContent: {
    flex: 1,
  },
  sectionTitle: {
    color: '#020617',
    fontSize: 20,
    fontWeight: '900',
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
