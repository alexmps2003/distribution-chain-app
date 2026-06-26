import Link from "next/link";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getValidationErrorMessage } from "@/lib/validation/errors";
import { parsePaymentFormData } from "@/lib/validation/payment";

import CustomerSelect from "./CustomerSelect";
import PaymentMethodEntry, {
  type InitialPaymentMethodEntryState,
  type PaymentMethod,
} from "./PaymentMethodEntry";

const PAYMENT_FORM_COOKIE = "last-invalid-payment-form";

type OutstandingInvoice = Prisma.InvoiceGetPayload<{
  include: {
    payments: {
      select: {
        amount: true;
        paymentPart: {
          select: {
            status: true;
          };
        };
      };
    };
  };
}>;

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

function sumDecimals(values: Prisma.Decimal[]) {
  return values.reduce(
    (total, value) => total.plus(value),
    new Prisma.Decimal(0),
  );
}

function addToDecimalMap(
  map: Map<string, Prisma.Decimal>,
  key: string,
  amount: Prisma.Decimal,
) {
  map.set(key, (map.get(key) ?? new Prisma.Decimal(0)).plus(amount));
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
  const paymentTotal = sumDecimals(paymentParts.map((part) => part.amount));
  const allocationTotal = sumDecimals(
    allocations.map((allocation) => allocation.amount),
  );

  if (!paymentTotal.gt(0)) {
    throw new Error("Payment total must be greater than 0");
  }

  if (!paymentTotal.equals(allocationTotal)) {
    throw new Error("Payment total must equal allocation total");
  }

  const allocationByInvoice = new Map(
    allocations.map((allocation) => [allocation.invoiceId, allocation.amount]),
  );
  const methodAllocationByInvoice = new Map<string, Prisma.Decimal>();

  for (const part of paymentParts) {
    for (const allocation of part.allocations) {
      if (!allocationByInvoice.has(allocation.invoiceId)) {
        throw new Error("Method allocation must match a selected invoice");
      }

      addToDecimalMap(
        methodAllocationByInvoice,
        allocation.invoiceId,
        allocation.amount,
      );
    }
  }

  for (const allocation of allocations) {
    const methodAllocationTotal =
      methodAllocationByInvoice.get(allocation.invoiceId) ??
      new Prisma.Decimal(0);

    if (!methodAllocationTotal.equals(allocation.amount)) {
      throw new Error(
        "Method allocations for each invoice must equal the overall invoice allocation",
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    const invoices = await tx.invoice.findMany({
      where: {
        customerId,
        id: {
          in: allocations.map((allocation) => allocation.invoiceId),
        },
      },
      include: {
        payments: {
          select: {
            amount: true,
            paymentPart: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    if (invoices.length !== allocations.length) {
      throw new Error("One or more selected invoices could not be found");
    }

    const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

    for (const allocation of allocations) {
      const invoice = invoiceById.get(allocation.invoiceId);

      if (!invoice) {
        throw new Error("Selected invoice could not be found");
      }

      const previouslyAllocated = sumDecimals(
        invoice.payments.map((payment) => payment.amount),
      );
      const outstanding = invoice.amount.minus(previouslyAllocated);

      if (allocation.amount.gt(outstanding)) {
        throw new Error(
          `Allocation exceeds outstanding amount for invoice ${invoice.invoiceNumber}`,
        );
      }
    }

    const payment = await tx.payment.create({
      data: {
        customerId,
        paymentDate,
        notes,
        amount: paymentTotal,
        paymentMethod:
          paymentParts.length === 1 ? paymentParts[0].method : "MIXED",
      },
    });

    for (const part of paymentParts) {
      const paymentPart = await tx.paymentPart.create({
        data: {
          paymentId: payment.id,
          method: part.method,
          amount: part.amount,
          chequeNumber: part.chequeNumber,
          chequeBank: part.chequeBank,
          chequeDate: part.chequeDate,
          bankReference: part.bankReference,
          cardReference: part.cardReference,
        },
      });

      for (const allocation of part.allocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: allocation.invoiceId,
            amount: allocation.amount,
            paymentPartId: paymentPart.id,
          },
        });
      }
    }

    for (const allocation of allocations) {
      const invoice = invoiceById.get(allocation.invoiceId);

      if (!invoice) {
        continue;
      }

      const previouslyAllocated = sumDecimals(
        invoice.payments.map((payment) => payment.amount),
      );
      const paidTotal = previouslyAllocated.plus(allocation.amount);
      const status = paidTotal.gte(invoice.amount)
        ? "PAID"
        : paidTotal.gt(0)
          ? "PARTIALLY_PAID"
          : "UNPAID";

      await tx.invoice.update({
        where: {
          id: invoice.id,
        },
        data: {
          status,
        },
      });
    }
  });

  const cookieStore = await cookies();

  cookieStore.delete(PAYMENT_FORM_COOKIE);

  redirect("/payments");
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

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  let outstandingInvoices: OutstandingInvoice[] = [];
  if (customerId) {
    outstandingInvoices = await prisma.invoice.findMany({
      where: {
        customerId,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
      include: {
        payments: {
          select: {
            amount: true,
            paymentPart: {
              select: {
                status: true,
              },
            },
          },
        },
      },
      orderBy: { invoiceDate: "asc" },
    });
  }

  const allocationInvoices = outstandingInvoices
    .map((invoice) => {
      const activeAllocated = sumDecimals(
        invoice.payments
          .filter((allocation) => {
            return (
              allocation.paymentPart === null ||
              allocation.paymentPart.status === "ACTIVE"
            );
          })
          .map((allocation) => allocation.amount),
      );
      const outstandingAmount = invoice.amount.minus(activeAllocated);

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate?.toISOString() ?? null,
        invoiceTotal: invoice.amount.toString(),
        outstandingAmount: outstandingAmount.toFixed(2),
        status: invoice.status,
      };
    })
    .filter((invoice) => Number(invoice.outstandingAmount) > 0);
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
