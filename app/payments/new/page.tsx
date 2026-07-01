import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api-client-server";
import { getAuthenticatedUserServer } from "@/lib/auth-user-server";
import { canCreatePayment } from "@/lib/permissions";
import { withToast } from "@/lib/toast";
import { getValidationErrorMessage } from "@/lib/validation/errors";
import { parsePaymentFormData } from "@/lib/validation/payment";

import CustomerSelect from "./CustomerSelect";
import PaymentMethodEntry, {
  type InitialPaymentMethodEntryState,
  type PaymentMethod,
} from "./PaymentMethodEntry";

const PAYMENT_FORM_COOKIE = "last-invalid-payment-form";

type MoneyValue = string | number;
type ParsedMoneyValue = { toString(): string };
type MoneyInput = MoneyValue | ParsedMoneyValue;

type CreatePaymentPayload = {
  customerId: string;
  paymentDate: string;
  notes?: string;
  amount: string;
  methods: {
    method: PaymentMethod;
    amount: string;
    chequeNumber?: string;
    chequeBank?: string;
    chequeDate?: string;
    bankReference?: string;
    cardReference?: string;
    allocations: {
      invoiceId: string;
      amount: string;
    }[];
  }[];
};

type CustomerListResponse = {
  customer: {
    code: string;
    id: string;
    isActive: boolean;
    name: string;
  };
}[];

type InvoiceListResponse = {
  invoices: {
    invoice: {
      amount: MoneyValue;
      dueDate: string | null;
      id: string;
      invoiceDate: string;
      invoiceNumber: string;
    };
    activePaidAmount: MoneyValue;
    displayStatus: string;
    outstanding: MoneyValue;
  }[];
};

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function redirectPaymentError(message: string, customerId?: string): never {
  const params = new URLSearchParams({
    error: message,
  });

  if (customerId) {
    params.set("customerId", customerId);
  }

  redirect(`/payments/new?${params.toString()}`);
}

type PreservedPaymentFormValues = Record<string, string[]>;

function getPreservedValue(
  values: PreservedPaymentFormValues | undefined,
  name: string,
) {
  return values?.[name]?.[0] ?? "";
}

function serializeFormData(formData: FormData) {
  const values: PreservedPaymentFormValues = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") {
      continue;
    }

    values[key] = [...(values[key] ?? []), value];
  }

  return JSON.stringify(values);
}

function parsePreservedPaymentForm(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, entry]) => [
        key,
        Array.isArray(entry)
          ? entry.filter((item): item is string => typeof item === "string")
          : [],
      ]),
    );
  } catch {
    return undefined;
  }
}

function getPaymentMethodDetails({
  chequeBank,
  chequeDate,
  chequeNumber,
  method,
  referenceNumber,
}: {
  chequeBank: string;
  chequeDate: string;
  chequeNumber: string;
  method: PaymentMethod;
  referenceNumber: string;
}) {
  if (method === "CHEQUE") {
    return [chequeNumber ? `Cheque ${chequeNumber}` : "", chequeBank, chequeDate]
      .filter(Boolean)
      .join(" - ");
  }

  if (method === "BANK_TRANSFER" || method === "CARD") {
    return referenceNumber ? `Ref ${referenceNumber}` : "";
  }

  return "";
}

function buildInitialPaymentMethodState(
  values: PreservedPaymentFormValues | undefined,
  invoices: { id: string; invoiceNumber: string }[],
): InitialPaymentMethodEntryState | undefined {
  if (!values) {
    return undefined;
  }

  const selectedInvoices = Object.fromEntries(
    (values.invoiceIds ?? []).map((invoiceId) => [invoiceId, true]),
  );
  const allocationAmounts = Object.fromEntries(
    (values.invoiceIds ?? []).map((invoiceId) => [
      invoiceId,
      getPreservedValue(values, `allocationAmount:${invoiceId}`),
    ]),
  );
  const invoiceNumberById = new Map(
    invoices.map((invoice) => [invoice.id, invoice.invoiceNumber]),
  );
  const addedMethods = (values.addedMethodIds ?? []).flatMap((clientId) => {
    const method = getPreservedValue(values, `addedMethod:${clientId}:method`);

    if (
      method !== "CASH" &&
      method !== "CHEQUE" &&
      method !== "BANK_TRANSFER" &&
      method !== "CARD"
    ) {
      return [];
    }

    const restoredMethod: PaymentMethod = method;

    const chequeBank = getPreservedValue(
      values,
      `addedMethod:${clientId}:chequeBankName`,
    );
    const chequeDate = getPreservedValue(
      values,
      `addedMethod:${clientId}:chequeDate`,
    );
    const chequeNumber = getPreservedValue(
      values,
      `addedMethod:${clientId}:chequeNumber`,
    );
    const referenceNumber =
      getPreservedValue(values, `addedMethod:${clientId}:bankReference`) ||
      getPreservedValue(values, `addedMethod:${clientId}:cardReference`);

    return [
      {
        id: clientId,
        method: restoredMethod,
        amount: getPreservedValue(values, `addedMethod:${clientId}:amount`),
        details: getPaymentMethodDetails({
          chequeBank,
          chequeDate,
          chequeNumber,
          method: restoredMethod,
          referenceNumber,
        }),
        chequeNumber: chequeNumber || undefined,
        chequeBank: chequeBank || undefined,
        chequeDate: chequeDate || undefined,
        bankReference:
          restoredMethod === "BANK_TRANSFER"
            ? referenceNumber || undefined
            : undefined,
        cardReference:
          restoredMethod === "CARD" ? referenceNumber || undefined : undefined,
        allocations: (
          values[`addedMethod:${clientId}:invoiceIds`] ?? []
        ).map((invoiceId) => ({
          invoiceId,
          invoiceNumber: invoiceNumberById.get(invoiceId) ?? invoiceId,
          amount: getPreservedValue(
            values,
            `addedMethod:${clientId}:allocation:${invoiceId}`,
          ),
        })),
      },
    ];
  });

  return {
    addedMethods,
    allocationAmounts,
    selectedInvoices,
  };
}

function toCents(value: MoneyInput): number {
  const text = String(value);
  const sign = text.startsWith("-") ? -1 : 1;
  const [wholePart, fractionPart = ""] = text.replace("-", "").split(".");
  const wholeCents = Number(wholePart || "0") * 100;
  const fractionCents = Number(fractionPart.padEnd(2, "0").slice(0, 2));

  return sign * (wholeCents + fractionCents);
}

function sumCents(values: MoneyInput[]): number {
  return values.reduce<number>((total, value) => total + toCents(value), 0);
}

function addToCentMap(
  map: Map<string, number>,
  key: string,
  amount: MoneyInput,
) {
  map.set(key, (map.get(key) ?? 0) + toCents(amount));
}

function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absoluteCents = Math.abs(cents);

  return `${sign}${Math.floor(absoluteCents / 100)}.${String(
    absoluteCents % 100,
  ).padStart(2, "0")}`;
}

function formatMoneyInput(value: MoneyInput): string {
  return formatCents(toCents(value));
}

async function createPayment(formData: FormData) {
  "use server";

  let paymentInput;
  const submittedCustomerId = getString(formData, "customerId");

  try {
    paymentInput = parsePaymentFormData(formData);
  } catch (validationError) {
    const cookieStore = await cookies();

    cookieStore.set(PAYMENT_FORM_COOKIE, serializeFormData(formData), {
      httpOnly: true,
      maxAge: 300,
      path: "/payments/new",
      sameSite: "lax",
    });

    redirectPaymentError(
      getValidationErrorMessage(validationError),
      submittedCustomerId || undefined,
    );
  }

  const customerId = paymentInput.customerId;
  const paymentDate = paymentInput.paymentDate;
  const notes = paymentInput.notes;
  const paymentParts = paymentInput.methods;
  const allocations = paymentInput.allocations;
  const paymentTotal = sumCents(paymentParts.map((part) => part.amount));
  const allocationTotal = sumCents(
    allocations.map((allocation) => allocation.amount),
  );

  if (paymentTotal <= 0) {
    throw new Error("Payment total must be greater than 0");
  }

  if (paymentTotal !== allocationTotal) {
    throw new Error("Payment total must equal allocation total");
  }

  const allocationByInvoice = new Map(
    allocations.map((allocation) => [
      allocation.invoiceId,
      toCents(allocation.amount),
    ]),
  );
  const methodAllocationByInvoice = new Map<string, number>();

  for (const part of paymentParts) {
    for (const allocation of part.allocations) {
      if (!allocationByInvoice.has(allocation.invoiceId)) {
        throw new Error("Method allocation must match a selected invoice");
      }

      addToCentMap(
        methodAllocationByInvoice,
        allocation.invoiceId,
        allocation.amount,
      );
    }
  }

  for (const allocation of allocations) {
    const methodAllocationTotal =
      methodAllocationByInvoice.get(allocation.invoiceId) ?? 0;

    if (methodAllocationTotal !== toCents(allocation.amount)) {
      throw new Error(
        "Method allocations for each invoice must equal the overall invoice allocation",
      );
    }
  }

  await apiPost<unknown, CreatePaymentPayload>("/payments", {
    customerId,
    paymentDate: paymentDate.toISOString(),
    notes,
    amount: formatCents(paymentTotal),
    methods: paymentParts.map((part) => ({
      method: part.method,
      amount: formatMoneyInput(part.amount),
      chequeNumber: part.chequeNumber,
      chequeBank: part.chequeBank,
      chequeDate: part.chequeDate?.toISOString(),
      bankReference: part.bankReference,
      cardReference: part.cardReference,
      allocations: part.allocations.map((allocation) => ({
        invoiceId: allocation.invoiceId,
        amount: formatMoneyInput(allocation.amount),
      })),
    })),
  });

  const cookieStore = await cookies();

  cookieStore.delete(PAYMENT_FORM_COOKIE);

  redirect(withToast("/payments", "success", "Payment recorded"));
}

export default async function NewPaymentPage(props: {
  searchParams: Promise<{ customerId?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const customerId = searchParams?.customerId;
  const error = searchParams?.error;
  const cookieStore = await cookies();
  const preservedPaymentForm = error
    ? parsePreservedPaymentForm(cookieStore.get(PAYMENT_FORM_COOKIE)?.value)
    : undefined;

  const [customerRows, authenticatedUser] = await Promise.all([
    apiGet<CustomerListResponse>("/customers"),
    getAuthenticatedUserServer(),
  ]);
  const canCreatePayments = canCreatePayment(authenticatedUser.role);
  const customers = customerRows
    .filter((row) => row.customer.isActive)
    .sort((left, right) =>
      left.customer.name.localeCompare(right.customer.name),
    )
    .map((row) => ({
      id: row.customer.id,
      name: row.customer.name,
      code: row.customer.code,
    }));

  let outstandingInvoices: InvoiceListResponse["invoices"] = [];
  if (customerId) {
    try {
      const invoiceResponse = await apiGet<InvoiceListResponse>(
        `/invoices?customerId=${encodeURIComponent(customerId)}`,
      );

      outstandingInvoices = invoiceResponse.invoices;
    } catch (fetchError) {
      if (
        !(fetchError instanceof Error) ||
        !fetchError.message.includes("failed with 404")
      ) {
        throw fetchError;
      }
    }
  }

  const allocationInvoices = outstandingInvoices
    .filter((row) => Number(String(row.outstanding)) > 0)
    .sort((left, right) =>
      left.invoice.invoiceDate.localeCompare(right.invoice.invoiceDate),
    )
    .map(({ displayStatus, invoice, outstanding }) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      dueDate: invoice.dueDate,
      invoiceTotal: invoice.amount.toString(),
      outstandingAmount: Number(String(outstanding)).toFixed(2),
      status: displayStatus,
    }));
  const initialPaymentMethodState = buildInitialPaymentMethodState(
    preservedPaymentForm,
    allocationInvoices,
  );

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Record Payment
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Record a new payment from a customer.
            </p>
          </div>
          <Link
            href="/payments"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
          >
            Back to Payments
          </Link>
        </div>

        <form
          noValidate
          className="grid gap-6 rounded-md border border-zinc-200 bg-white p-6"
        >
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-medium tracking-tight">
              Payment Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Customer <span className="text-red-500">*</span>
                <CustomerSelect customers={customers} />
              </label>

              <Field
                label="Payment Date"
                name="paymentDate"
                type="date"
                required
                defaultValue={getPreservedValue(
                  preservedPaymentForm,
                  "paymentDate",
                )}
              />
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
              Notes
              <textarea
                name="notes"
                placeholder="Optional notes about this payment..."
                defaultValue={getPreservedValue(preservedPaymentForm, "notes")}
                className="h-20 resize-none rounded-md border border-zinc-300 bg-white p-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
          </div>

          <PaymentMethodEntry
            canSavePayment={canCreatePayments}
            customerId={customerId}
            initialState={initialPaymentMethodState}
            invoices={allocationInvoices}
            saveAction={createPayment}
          />

        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
      {label} {required && <span className="text-red-500">*</span>}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      />
    </label>
  );
}
