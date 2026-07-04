import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppModal } from '../components/AppModal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SkeletonCardList } from '../components/SkeletonCard';
import { apiGet, apiPost } from '../lib/api-client';
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
  allocations: {
    amount: string;
    invoiceId: string;
    invoiceNumber: string;
  }[];
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

type CreatePaymentPayload = {
  amount: string;
  customerId: string;
  methods: {
    allocations: {
      amount: string;
      invoiceId: string;
    }[];
    amount: string;
    bankReference?: string;
    cardReference?: string;
    chequeBank?: string;
    chequeDate?: string;
    chequeNumber?: string;
    method: PaymentMethod;
  }[];
  notes?: string;
};

type PaymentModal = {
  message: string;
  onPrimaryPress: () => void;
  primaryLabel: string;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  title: string;
};

const paymentMethods: { id: PaymentMethod; label: string }[] = [
  { id: 'CASH', label: 'Cash' },
  { id: 'CHEQUE', label: 'Cheque' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { id: 'CARD', label: 'Card' },
];

const BANK_OPTIONS = [
  'Amana Bank PLC',
  'Bank of Ceylon',
  'Bank of China Limited',
  'Cargills Bank PLC',
  'Citibank, N.A.',
  'Commercial Bank of Ceylon PLC',
  'Deutsche Bank AG, Colombo Branch',
  'DFCC Bank PLC',
  'Habib Bank Ltd',
  'Hatton National Bank PLC',
  'Indian Bank',
  'Indian Overseas Bank',
  'MCB Bank Ltd',
  'National Development Bank PLC',
  'Nations Trust Bank PLC',
  'Pan Asia Banking Corporation PLC',
  "People's Bank",
  'Public Bank Berhad',
  'Sampath Bank PLC',
  'Seylan Bank PLC',
  'Standard Chartered Bank',
  'State Bank of India',
  'The Hongkong & Shanghai Banking Corporation Ltd (HSBC)',
  'Union Bank of Colombo PLC',
  'Other',
] as const;

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

function createInitialMethodAllocationDrafts(): Record<
  PaymentMethod,
  Record<string, string>
> {
  return {
    BANK_TRANSFER: {},
    CARD: {},
    CASH: {},
    CHEQUE: {},
  };
}

export default function CustomerPaymentScreen() {
  const { accessToken } = useAuth();
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const invoiceLayouts = useRef<Record<string, { y: number }>>({});
  const [data, setData] = useState<CustomerInvoicesResponse | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH');
  const [methodDrafts, setMethodDrafts] = useState<
    Record<PaymentMethod, MethodDraft>
  >(createInitialMethodDrafts);
  const [methodAllocationDrafts, setMethodAllocationDrafts] = useState<
    Record<PaymentMethod, Record<string, string>>
  >(createInitialMethodAllocationDrafts);
  const [addedMethods, setAddedMethods] = useState<AddedMethod[]>([]);
  const [isChequeDatePickerOpen, setIsChequeDatePickerOpen] = useState(false);
  const [chequeDatePickerValue, setChequeDatePickerValue] = useState(
    () => new Date(),
  );
  const [isChequeBankPickerOpen, setIsChequeBankPickerOpen] = useState(false);
  const [methodMessage, setMethodMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModal | null>(null);

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
          setMethodAllocationDrafts(createInitialMethodAllocationDrafts());
          setAddedMethods([]);
          setIsChequeDatePickerOpen(false);
          setChequeDatePickerValue(new Date());
          setIsChequeBankPickerOpen(false);
          setMethodMessage('');
          setSaveMessage('');
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

  const addedMethodsTotalCents = useMemo(() => {
    return addedMethods.reduce((total, method) => {
      return total + toCents(method.amount);
    }, 0);
  }, [addedMethods]);

  const selectedMethodDraft = methodDrafts[selectedMethod];
  const selectedMethodAllocationDraft = methodAllocationDrafts[selectedMethod];
  const selectedMethodAmountCents = toCents(selectedMethodDraft.amount);

  const selectedAllocationInvoices = useMemo(() => {
    return openInvoices
      .map((invoice) => {
        const invoiceId = invoice.invoice.id;

        return {
          allocatedCents: toCents(allocations[invoiceId] ?? ''),
          invoiceId,
          invoiceNumber: invoice.invoice.invoiceNumber,
        };
      })
      .filter((invoice) => invoice.allocatedCents > 0);
  }, [allocations, openInvoices]);

  const addedAllocationByInvoice = useMemo(() => {
    return addedMethods.reduce<Record<string, number>>((totals, method) => {
      for (const allocation of method.allocations) {
        totals[allocation.invoiceId] =
          (totals[allocation.invoiceId] ?? 0) + toCents(allocation.amount);
      }

      return totals;
    }, {});
  }, [addedMethods]);

  const remainingAllocationByInvoice = useMemo(() => {
    return selectedAllocationInvoices.reduce<Record<string, number>>(
      (remaining, invoice) => {
        const alreadyAdded = addedAllocationByInvoice[invoice.invoiceId] ?? 0;

        remaining[invoice.invoiceId] = Math.max(
          invoice.allocatedCents - alreadyAdded,
          0,
        );

        return remaining;
      },
      {},
    );
  }, [addedAllocationByInvoice, selectedAllocationInvoices]);

  const selectedMethodAllocationTotalCents = useMemo(() => {
    return selectedAllocationInvoices.reduce((total, invoice) => {
      return (
        total +
        toCents(selectedMethodAllocationDraft[invoice.invoiceId] ?? '')
      );
    }, 0);
  }, [selectedAllocationInvoices, selectedMethodAllocationDraft]);

  const hasMethodAllocationOverRemaining = selectedAllocationInvoices.some(
    (invoice) => {
      return (
        toCents(selectedMethodAllocationDraft[invoice.invoiceId] ?? '') >
        (remainingAllocationByInvoice[invoice.invoiceId] ?? 0)
      );
    },
  );

  const hasInvalidAddedMethod = useMemo(() => {
    return addedMethods.some((method) => {
      if (toCents(method.amount) <= 0) {
        return true;
      }

      if (method.method === 'CHEQUE') {
        return (
          !method.chequeNumber?.trim() ||
          !method.chequeBank?.trim() ||
          !method.chequeDate?.trim()
        );
      }

      return false;
    });
  }, [addedMethods]);

  const hasFinalPerInvoiceMismatch = selectedAllocationInvoices.some(
    (invoice) => {
      return (
        (addedAllocationByInvoice[invoice.invoiceId] ?? 0) !==
        invoice.allocatedCents
      );
    },
  );

  function updateAllocation(invoice: InvoiceRow, value: string) {
    const invoiceId = invoice.invoice.id;
    const sanitizedValue = sanitizeAllocationInput(value);
    const outstandingCents = toCents(invoice.outstanding);
    const allocationCents = toCents(sanitizedValue);
    const nextValue =
      allocationCents > outstandingCents
        ? formatInputFromCents(outstandingCents)
        : sanitizedValue;

    setMethodMessage('');
    setSaveMessage('');
    setAllocations((current) => ({
      ...current,
      [invoiceId]: nextValue,
    }));
  }

  function updateMethodDraft(field: keyof MethodDraft, value: string) {
    const nextValue = field === 'amount' ? sanitizeAllocationInput(value) : value;

    setMethodMessage('');
    setSaveMessage('');
    setMethodDrafts((current) => ({
      ...current,
      [selectedMethod]: {
        ...current[selectedMethod],
        [field]: nextValue,
      },
    }));
  }

  function updateMethodAllocation(invoiceId: string, value: string) {
    const sanitizedValue = sanitizeAllocationInput(value);
    const requestedCents = toCents(sanitizedValue);
    const remainingCents = remainingAllocationByInvoice[invoiceId] ?? 0;
    const nextValue =
      requestedCents > remainingCents
        ? formatInputFromCents(remainingCents)
        : sanitizedValue;

    setMethodMessage('');
    setSaveMessage('');
    setMethodAllocationDrafts((current) => ({
      ...current,
      [selectedMethod]: {
        ...current[selectedMethod],
        [invoiceId]: nextValue,
      },
    }));
  }

  function addMethod() {
    const draft = methodDrafts[selectedMethod];
    const amountCents = toCents(draft.amount);

    if (totalAllocatedCents <= 0) {
      setMethodMessage('Allocate at least one invoice before adding a method.');
      return;
    }

    if (amountCents <= 0) {
      setMethodMessage('Method amount must be greater than 0.');
      return;
    }

    if (selectedAllocationInvoices.length === 0) {
      setMethodMessage('Allocate at least one invoice before adding a method.');
      return;
    }

    if (addedMethodsTotalCents + amountCents > totalAllocatedCents) {
      setMethodMessage('Added methods cannot exceed total invoice allocation.');
      return;
    }

    if (selectedMethodAllocationTotalCents !== amountCents) {
      setMethodMessage('Method allocations must equal the method amount.');
      return;
    }

    if (hasMethodAllocationOverRemaining) {
      setMethodMessage(
        'Method allocation cannot exceed invoice remaining amount.',
      );
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

    const methodAllocations = selectedAllocationInvoices
      .map((invoice) => ({
        amount: formatInputFromCents(
          toCents(selectedMethodAllocationDraft[invoice.invoiceId] ?? ''),
        ),
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
      }))
      .filter((allocation) => toCents(allocation.amount) > 0);

    if (methodAllocations.length === 0) {
      setMethodMessage('Add at least one method allocation amount.');
      return;
    }

    const addedMethod: AddedMethod = {
      method: selectedMethod,
      amount: formatInputFromCents(amountCents),
      allocations: methodAllocations,
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
    setMethodAllocationDrafts((current) => ({
      ...current,
      [selectedMethod]: {},
    }));
    setIsChequeDatePickerOpen(false);
    setIsChequeBankPickerOpen(false);
    setMethodMessage('');
    setSaveMessage('');
  }

  function removeAddedMethod(methodIndex: number) {
    setAddedMethods((current) =>
      current.filter((_, index) => index !== methodIndex),
    );
    setMethodMessage('');
    setSaveMessage('');
  }

  function updateChequeDate(
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) {
    if (Platform.OS === 'android') {
      setIsChequeDatePickerOpen(false);

      if (event.type !== 'dismissed' && selectedDate) {
        updateMethodDraft('chequeDate', formatDateInput(selectedDate));
      }

      return;
    }

    if (selectedDate) {
      setChequeDatePickerValue(selectedDate);
    }
  }

  function confirmChequeDate() {
    updateMethodDraft('chequeDate', formatDateInput(chequeDatePickerValue));
    setIsChequeDatePickerOpen(false);
  }

  function cancelChequeDate() {
    setIsChequeDatePickerOpen(false);
  }

  function openChequeDatePicker() {
    Keyboard.dismiss();
    setIsChequeBankPickerOpen(false);
    setChequeDatePickerValue(getDatePickerValue(selectedMethodDraft.chequeDate));
    setIsChequeDatePickerOpen(true);
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

  function getAddMethodDisabledMessage() {
    if (totalAllocatedCents <= 0) {
      return 'Allocate at least one invoice before adding a method.';
    }

    if (selectedMethodAmountCents <= 0) {
      return 'Enter a method amount greater than 0.';
    }

    if (
      addedMethodsTotalCents + selectedMethodAmountCents >
      totalAllocatedCents
    ) {
      return 'Added methods cannot exceed total invoice allocation.';
    }

    if (selectedAllocationInvoices.length === 0) {
      return 'Allocate at least one invoice before adding a method.';
    }

    if (hasMethodAllocationOverRemaining) {
      return 'Method allocation cannot exceed invoice remaining amount.';
    }

    if (selectedMethodAllocationTotalCents !== selectedMethodAmountCents) {
      return 'Method allocations must equal the method amount.';
    }

    return '';
  }

  const addMethodDisabledMessage = getAddMethodDisabledMessage();
  const isAddMethodDisabled = addMethodDisabledMessage !== '';

  function getSavePaymentDisabledMessage() {
    if (totalAllocatedCents <= 0) {
      return 'Allocate at least one invoice before saving.';
    }

    if (addedMethods.length === 0) {
      return 'Add at least one payment method before saving.';
    }

    if (hasInvalidAddedMethod) {
      return 'Check added payment method details before saving.';
    }

    if (addedMethodsTotalCents !== totalAllocatedCents) {
      return 'Added methods must match total invoice allocation.';
    }

    if (hasFinalPerInvoiceMismatch) {
      return 'Method allocations for each invoice must match invoice allocations.';
    }

    return '';
  }

  const savePaymentDisabledMessage = getSavePaymentDisabledMessage();
  const isSavePaymentDisabled =
    isSaving || savePaymentDisabledMessage !== '';

  function resetPaymentState() {
    setAllocations({});
    setMethodDrafts(createInitialMethodDrafts());
    setMethodAllocationDrafts(createInitialMethodAllocationDrafts());
    setAddedMethods([]);
    setIsChequeDatePickerOpen(false);
    setChequeDatePickerValue(new Date());
    setIsChequeBankPickerOpen(false);
    setMethodMessage('');
    setSaveMessage('');
  }

  async function savePayment() {
    if (savePaymentDisabledMessage) {
      setSaveMessage(savePaymentDisabledMessage);
      return;
    }

    const currentCustomerId = data?.customer.id ?? customerId;

    if (!currentCustomerId) {
      setSaveMessage('Customer is required.');
      return;
    }

    const payload: CreatePaymentPayload = {
      customerId: currentCustomerId,
      amount: formatInputFromCents(totalAllocatedCents),
      methods: addedMethods.map((method) => ({
        method: method.method,
        amount: method.amount,
        chequeNumber: method.chequeNumber,
        chequeBank: method.chequeBank,
        chequeDate: method.chequeDate,
        bankReference: method.bankReference,
        cardReference: method.cardReference,
        allocations: method.allocations.map((allocation) => ({
          invoiceId: allocation.invoiceId,
          amount: allocation.amount,
        })),
      })),
    };

    try {
      setIsSaving(true);
      setSaveMessage('');

      await apiPost<unknown, CreatePaymentPayload>(
        '/payments',
        payload,
        accessToken ?? undefined,
      );

      resetPaymentState();
      setPaymentModal({
        title: 'Payment saved',
        message: 'Payment recorded successfully.',
        primaryLabel: 'OK',
        onPrimaryPress: () => {
          setPaymentModal(null);
          router.replace('/search-customer');
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : '';
      const message = errorMessage.startsWith('API POST /payments')
        ? 'Payment failed. Please try again.'
        : errorMessage || 'Payment failed. Please try again.';

      setSaveMessage(message);
      setPaymentModal({
        title: 'Payment failed',
        message,
        primaryLabel: 'OK',
        onPrimaryPress: () => {
          setPaymentModal(null);
        },
      });
    } finally {
      setIsSaving(false);
    }
  }

  function confirmSavePayment() {
    const methodSummary = addedMethods
      .map(
        (method) =>
          `• ${getMethodLabel(method.method)} — ${formatMoney(method.amount)}`,
      )
      .join('\n');
    const message = [
      `Customer: ${data?.customer.name ?? 'Customer'}`,
      '',
      `Total Payment: ${formatMoneyFromCents(addedMethodsTotalCents)}`,
      '',
      'Methods:',
      methodSummary,
      '',
      'Are you sure you want to record this payment?',
    ].join('\n');

    setPaymentModal({
      title: 'Confirm Payment',
      message,
      primaryLabel: 'Save Payment',
      onPrimaryPress: () => {
        setPaymentModal(null);
        void savePayment();
      },
      secondaryLabel: 'Cancel',
      onSecondaryPress: () => {
        setPaymentModal(null);
      },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.screenContent}>
          <Pressable onPress={Keyboard.dismiss} style={styles.header}>
            <Text style={styles.kicker}>Record Payment</Text>
            <Text style={styles.title}>
              {data?.customer.name ?? 'Loading customer'}
            </Text>
            {data?.customer.code ? (
              <Text style={styles.subtitle}>{data.customer.code}</Text>
            ) : null}
          </Pressable>

            {isLoading ? (
              <View style={styles.loadingStateWrap}>
                <SkeletonCardList count={2} />
              </View>
            ) : errorMessage ? (
              <View style={styles.emptyState}>
                <ErrorState error={errorMessage} />
              </View>
            ) : openInvoices.length === 0 ? (
              <View style={styles.emptyState}>
                <EmptyState
                  title="No unpaid invoices"
                  description="This customer has no unpaid or partially paid invoices."
                />
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
                            setIsChequeBankPickerOpen(false);
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
                        <BankSelectField
                          value={selectedMethodDraft.chequeBank}
                          isOpen={isChequeBankPickerOpen}
                          onToggle={() => {
                            Keyboard.dismiss();
                            setIsChequeDatePickerOpen(false);
                            setIsChequeBankPickerOpen((current) => !current);
                          }}
                          onSelect={(bank) => {
                            updateMethodDraft('chequeBank', bank);
                            setIsChequeBankPickerOpen(false);
                          }}
                        />
                        <ChequeDateField
                          value={selectedMethodDraft.chequeDate}
                          onPress={openChequeDatePicker}
                        />
                        {isChequeDatePickerOpen ? (
                          <>
                            <DateTimePicker
                              value={
                                Platform.OS === 'ios'
                                  ? chequeDatePickerValue
                                  : getDatePickerValue(
                                      selectedMethodDraft.chequeDate,
                                    )
                              }
                              mode="date"
                              display={
                                Platform.OS === 'ios' ? 'spinner' : 'default'
                              }
                              onChange={updateChequeDate}
                            />
                            {Platform.OS === 'ios' ? (
                              <View style={styles.chequeDatePickerActions}>
                                <Pressable
                                  style={[
                                    styles.chequeDatePickerButton,
                                    styles.chequeDatePickerCancelButton,
                                  ]}
                                  onPress={cancelChequeDate}
                                >
                                  <Text
                                    style={styles.chequeDatePickerCancelText}
                                  >
                                    Cancel
                                  </Text>
                                </Pressable>
                                <Pressable
                                  style={[
                                    styles.chequeDatePickerButton,
                                    styles.chequeDatePickerDoneButton,
                                  ]}
                                  onPress={confirmChequeDate}
                                >
                                  <Text
                                    style={styles.chequeDatePickerDoneText}
                                  >
                                    Done
                                  </Text>
                                </Pressable>
                              </View>
                            ) : null}
                          </>
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

                  <View style={styles.methodAllocationCard}>
                    <Text style={styles.methodAllocationTitle}>
                      Method Allocations
                    </Text>

                    {selectedAllocationInvoices.length === 0 ? (
                      <EmptyState
                        title="No method allocations"
                        description="Allocate invoices above to allocate this method."
                        variant="inline"
                      />
                    ) : (
                      <View style={styles.methodAllocationList}>
                        {selectedAllocationInvoices.map((invoice) => {
                          const remainingCents =
                            remainingAllocationByInvoice[invoice.invoiceId] ??
                            0;

                          return (
                            <View
                              key={invoice.invoiceId}
                              style={styles.methodAllocationRow}
                            >
                              <View style={styles.methodAllocationInfo}>
                                <Text style={styles.methodAllocationInvoice}>
                                  {invoice.invoiceNumber}
                                </Text>
                                <Text style={styles.methodAllocationRemaining}>
                                  Remaining{' '}
                                  {formatMoneyFromCents(remainingCents)}
                                </Text>
                              </View>

                              <TextInput
                                value={
                                  selectedMethodAllocationDraft[
                                    invoice.invoiceId
                                  ] ?? ''
                                }
                                onChangeText={(value) => {
                                  updateMethodAllocation(
                                    invoice.invoiceId,
                                    value,
                                  );
                                }}
                                placeholder="0.00"
                                placeholderTextColor="#94a3b8"
                                keyboardType="decimal-pad"
                                style={styles.methodAllocationInput}
                              />
                            </View>
                          );
                        })}
                      </View>
                    )}

                    <View style={styles.methodAllocationTotalRow}>
                      <Text style={styles.methodAllocationTotalLabel}>
                        Method Allocation Total
                      </Text>
                      <Text style={styles.methodAllocationTotalValue}>
                        {formatMoneyFromCents(
                          selectedMethodAllocationTotalCents,
                        )}
                      </Text>
                    </View>
                  </View>

                  {addMethodDisabledMessage || methodMessage ? (
                    <Text style={styles.methodMessage}>
                      {methodMessage || addMethodDisabledMessage}
                    </Text>
                  ) : null}

                  <Pressable
                    style={[
                      styles.addMethodButton,
                      isAddMethodDisabled
                        ? styles.addMethodButtonDisabled
                        : null,
                    ]}
                    disabled={isAddMethodDisabled}
                    onPress={addMethod}
                  >
                    <Text style={styles.addMethodButtonText}>Add Method</Text>
                  </Pressable>

                  <View style={styles.methodsAddedSection}>
                    <Text style={styles.sectionTitle}>Methods Added</Text>
                    {addedMethods.length === 0 ? (
                      <EmptyState
                        title="No methods added"
                        description="Added payment methods will appear here."
                      />
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
                          <View style={styles.addedMethodAllocations}>
                            {method.allocations.map((allocation) => (
                              <Text
                                key={allocation.invoiceId}
                                style={styles.addedMethodAllocationText}
                              >
                                {allocation.invoiceNumber}:{' '}
                                {formatMoney(allocation.amount)}
                              </Text>
                            ))}
                          </View>
                          <Pressable
                            style={styles.removeMethodButton}
                            onPress={() => {
                              removeAddedMethod(index);
                            }}
                          >
                            <Text style={styles.removeMethodButtonText}>
                              Remove
                            </Text>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.savePaymentSection}>
                    <Text
                      style={
                        savePaymentDisabledMessage
                          ? styles.savePaymentHint
                          : styles.savePaymentReady
                      }
                    >
                      {savePaymentDisabledMessage || 'Ready to save payment.'}
                    </Text>

                    {saveMessage ? (
                      <Text style={styles.savePaymentMessage}>
                        {saveMessage}
                      </Text>
                    ) : null}

                    <Pressable
                      style={[
                        styles.savePaymentButton,
                        isSavePaymentDisabled
                          ? styles.savePaymentButtonDisabled
                          : null,
                      ]}
                      disabled={isSavePaymentDisabled}
                      onPress={confirmSavePayment}
                    >
                      <Text style={styles.savePaymentButtonText}>
                        {isSaving ? 'Saving...' : 'Save Payment'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            )}
        </View>
      </KeyboardAvoidingView>
      <AppModal
        visible={paymentModal !== null}
        title={paymentModal?.title ?? ''}
        message={paymentModal?.message ?? ''}
        primaryLabel={paymentModal?.primaryLabel ?? 'OK'}
        onPrimaryPress={() => {
          paymentModal?.onPrimaryPress();
        }}
        secondaryLabel={paymentModal?.secondaryLabel}
        onSecondaryPress={paymentModal?.onSecondaryPress}
      />
      {isSaving ? (
        <View style={styles.savingOverlay}>
          <View style={styles.savingCard}>
            <ActivityIndicator color="#0369a1" size="large" />
            <Text style={styles.savingTitle}>Saving payment</Text>
            <Text style={styles.savingMessage}>
              Please wait while we record this payment.
            </Text>
          </View>
        </View>
      ) : null}
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

function BankSelectField({
  isOpen,
  onSelect,
  onToggle,
  value,
}: {
  isOpen: boolean;
  onSelect: (bank: string) => void;
  onToggle: () => void;
  value: string;
}) {
  return (
    <View style={styles.paymentField}>
      <Text style={styles.paymentFieldLabel}>Bank</Text>
      <Pressable style={styles.bankSelectButton} onPress={onToggle}>
        <Text
          style={value ? styles.bankSelectValue : styles.bankSelectPlaceholder}
        >
          {value || 'Select bank'}
        </Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.bankOptionList}>
          <ScrollView nestedScrollEnabled>
            {BANK_OPTIONS.map((bank) => (
              <Pressable
                key={bank}
                style={styles.bankOption}
                onPress={() => {
                  onSelect(bank);
                }}
              >
                <Text style={styles.bankOptionText}>{bank}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
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
  addMethodButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  addedMethodAmount: {
    color: '#0369a1',
    fontSize: 16,
    fontWeight: '900',
  },
  addedMethodAllocationText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  addedMethodAllocations: {
    gap: 4,
    marginTop: 10,
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
  bankOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bankOptionList: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 220,
    overflow: 'hidden',
  },
  bankOptionText: {
    color: '#020617',
    fontSize: 15,
    fontWeight: '700',
  },
  bankSelectButton: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bankSelectPlaceholder: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  bankSelectValue: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '700',
  },
  chequeDateButton: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chequeDatePickerActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  chequeDatePickerButton: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chequeDatePickerCancelButton: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
  },
  chequeDatePickerCancelText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '800',
  },
  chequeDatePickerDoneButton: {
    backgroundColor: '#020617',
  },
  chequeDatePickerDoneText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
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
    marginHorizontal: 20,
    marginTop: 4,
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
  loadingStateWrap: {
    marginHorizontal: 20,
    marginTop: 4,
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
  methodAllocationCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 14,
    padding: 18,
  },
  methodAllocationEmptyText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 12,
  },
  methodAllocationInfo: {
    flex: 1,
    paddingRight: 12,
  },
  methodAllocationInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    color: '#020617',
    fontSize: 16,
    fontWeight: '800',
    minWidth: 118,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'right',
  },
  methodAllocationInvoice: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '900',
  },
  methodAllocationList: {
    gap: 12,
    marginTop: 14,
  },
  methodAllocationRemaining: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  methodAllocationRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  methodAllocationTitle: {
    color: '#020617',
    fontSize: 18,
    fontWeight: '900',
  },
  methodAllocationTotalLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  methodAllocationTotalRow: {
    alignItems: 'center',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
  },
  methodAllocationTotalValue: {
    color: '#020617',
    fontSize: 15,
    fontWeight: '900',
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
  removeMethodButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  removeMethodButtonText: {
    color: '#be123c',
    fontSize: 14,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#f1f5f9',
    flex: 1,
  },
  savePaymentButton: {
    alignItems: 'center',
    backgroundColor: '#020617',
    borderRadius: 16,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  savePaymentButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  savePaymentButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  savePaymentHint: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  savePaymentMessage: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  savePaymentReady: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  savePaymentSection: {
    gap: 12,
    marginTop: 22,
  },
  savingCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    width: '100%',
  },
  savingMessage: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  savingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: 24,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  savingTitle: {
    color: '#020617',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 14,
    textAlign: 'center',
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
