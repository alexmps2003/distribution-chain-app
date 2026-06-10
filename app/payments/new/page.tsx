import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

import CustomerSelect from "./CustomerSelect";
import PaymentMethodEntry from "./PaymentMethodEntry";


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

type PaymentPartInput = {
  method: "CASH" | "CHEQUE" | "BANK_TRANSFER" | "CARD";
  amount: Prisma.Decimal;
  chequeNumber?: string;
  chequeBank?: string;
  chequeDate?: Date;
  bankReference?: string;
  cardReference?: string;
};

type AddedMethodInput = PaymentPartInput & {
  clientId: string;
  allocations: {
    invoiceId: string;
    amount: Prisma.Decimal;
  }[];
};

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getDecimal(formData: FormData, name: string) {
  const value = getString(formData, name);

  if (!value) {
    return new Prisma.Decimal(0);
  }

  try {
    const amount = new Prisma.Decimal(value);

    if (amount.isNegative()) {
      throw new Error(`${name} cannot be negative`);
    }

    return amount;
  } catch {
    throw new Error(`${name} must be a valid amount`);
  }
}

function sumDecimals(values: Prisma.Decimal[]) {
  return values.reduce(
    (total, value) => total.plus(value),
    new Prisma.Decimal(0),
  );
}

function buildAllocations(formData: FormData) {
  const invoiceIds = formData
    .getAll("invoiceIds")
    .filter((value): value is string => typeof value === "string");

  return invoiceIds.map((invoiceId) => {
    const amount = getDecimal(formData, `allocationAmount:${invoiceId}`);

    if (!amount.gt(0)) {
      throw new Error("Selected invoice allocation amounts must be greater than 0");
    }

    return {
      invoiceId,
      amount,
    };
  });
}

function getPaymentMethod(value: string): PaymentPartInput["method"] {
  if (
    value === "CASH" ||
    value === "CHEQUE" ||
    value === "BANK_TRANSFER" ||
    value === "CARD"
  ) {
    return value;
  }

  throw new Error("Payment method must be valid");
}

function getOptionalDate(value: string, fieldName: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be valid`);
  }

  return date;
}

function buildAddedMethods(formData: FormData): AddedMethodInput[] {
  const methodIds = formData
    .getAll("addedMethodIds")
    .filter((value): value is string => typeof value === "string");

  const methods = methodIds.map((clientId) => {
    const method = getPaymentMethod(
      getString(formData, `addedMethod:${clientId}:method`),
    );
    const amount = getDecimal(formData, `addedMethod:${clientId}:amount`);
    const chequeDateValue = getString(
      formData,
      `addedMethod:${clientId}:chequeDate`,
    );
    const invoiceIds = formData
      .getAll(`addedMethod:${clientId}:invoiceIds`)
      .filter((value): value is string => typeof value === "string");
    const allocations = invoiceIds.map((invoiceId) => {
      const allocationAmount = getDecimal(
        formData,
        `addedMethod:${clientId}:allocation:${invoiceId}`,
      );

      if (!allocationAmount.gt(0)) {
        throw new Error("Method allocation amounts must be greater than 0");
      }

      return {
        invoiceId,
        amount: allocationAmount,
      };
    });
    const allocationTotal = sumDecimals(
      allocations.map((allocation) => allocation.amount),
    );

    if (!amount.gt(0)) {
      throw new Error("Added method amounts must be greater than 0");
    }

    if (!amount.equals(allocationTotal)) {
      throw new Error("Each method amount must equal its method allocations");
    }

    return {
      clientId,
      method,
      amount,
      chequeNumber:
        method === "CHEQUE"
          ? getString(formData, `addedMethod:${clientId}:chequeNumber`) ||
            undefined
          : undefined,
      chequeBank:
        method === "CHEQUE"
          ? getString(formData, `addedMethod:${clientId}:chequeBank`) ||
            undefined
          : undefined,
      chequeDate:
        method === "CHEQUE"
          ? getOptionalDate(chequeDateValue, "Cheque date")
          : undefined,
      bankReference:
        method === "BANK_TRANSFER"
          ? getString(formData, `addedMethod:${clientId}:bankReference`) ||
            undefined
          : undefined,
      cardReference:
        method === "CARD"
          ? getString(formData, `addedMethod:${clientId}:cardReference`) ||
            undefined
          : undefined,
      allocations,
    };
  });

  if (methods.length === 0) {
    throw new Error("Add at least one payment method before saving");
  }

  return methods;
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

  const customerId = getString(formData, "customerId");
  const paymentDateValue = getString(formData, "paymentDate");
  const notes = getString(formData, "notes") || undefined;

  if (!customerId || !paymentDateValue) {
    throw new Error("Missing required payment fields");
  }

  const paymentDate = new Date(paymentDateValue);

  if (Number.isNaN(paymentDate.getTime())) {
    throw new Error("Payment date must be valid");
  }

  const paymentParts = buildAddedMethods(formData);
  const allocations = buildAllocations(formData);
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

  redirect("/payments");
}

export default async function NewPaymentPage(props: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const customerId = searchParams?.customerId;

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

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
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

        <form className="grid gap-6 rounded-md border border-zinc-200 bg-white p-6">
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
              />
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
              Notes
              <textarea
                name="notes"
                placeholder="Optional notes about this payment..."
                className="h-20 resize-none rounded-md border border-zinc-300 bg-white p-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
          </div>

          <PaymentMethodEntry
            customerId={customerId}
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
  min,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
      {label} {required && <span className="text-red-500">*</span>}
      <input
        name={name}
        type={type}
        required={required}
        min={min}
        step={step}
        placeholder={placeholder}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      />
    </label>
  );
}
