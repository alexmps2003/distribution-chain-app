import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import PrintReceiptButton from "./PrintReceiptButton";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(value: { toString(): string }) {
  return `LKR ${numberFormatter.format(Number(value.toString()))}`;
}

function formatDate(date: Date | null) {
  if (!date) return "-";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMethod(method: string) {
  return method.replace("_", " ");
}

function sumDecimals(values: Prisma.Decimal[]) {
  return values.reduce(
    (total, value) => total.plus(value),
    new Prisma.Decimal(0),
  );
}

function minDecimal(left: Prisma.Decimal, right: Prisma.Decimal) {
  return left.lte(right) ? left : right;
}

function getMethodDetails(part: {
  method: string;
  chequeNumber: string | null;
  chequeBank: string | null;
  chequeDate: Date | null;
  bankReference: string | null;
  cardReference: string | null;
}) {
  if (part.method === "CHEQUE") {
    return [
      part.chequeNumber ? `No: ${part.chequeNumber}` : "",
      part.chequeBank ? `Bank: ${part.chequeBank}` : "",
      part.chequeDate ? `Date: ${formatDate(part.chequeDate)}` : "",
    ]
      .filter(Boolean)
      .join(", ");
  }

  if (part.method === "BANK_TRANSFER") {
    return part.bankReference ? `Ref: ${part.bankReference}` : "-";
  }

  if (part.method === "CARD") {
    return part.cardReference ? `Ref: ${part.cardReference}` : "-";
  }

  return "-";
}

function formatStatus(status: string) {
  return status;
}

function getPaymentStatus(payment: unknown) {
  if (
    payment &&
    typeof payment === "object" &&
    "status" in payment &&
    typeof payment.status === "string"
  ) {
    return payment.status;
  }

  return null;
}

function getPaymentNumber(payment: unknown) {
  if (
    payment &&
    typeof payment === "object" &&
    "paymentNumber" in payment &&
    typeof payment.paymentNumber === "string"
  ) {
    return payment.paymentNumber;
  }

  return null;
}

function formatPaymentReference(payment: {
  id: string;
  paymentDate: Date;
}) {
  const datePart = payment.paymentDate
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
  const idPart = payment.id.slice(-4).toUpperCase();

  return `PAY-${datePart}-${idPart}`;
}

function getStatusBadgeClass(status: string) {
  if (status === "PAID" || status === "ACTIVE") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  }

  if (status === "PARTIALLY_PAID") {
    return "bg-amber-50 text-amber-700 ring-amber-600/20";
  }

  if (status === "REVERSED") {
    return "bg-red-50 text-red-700 ring-red-600/20";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-500/20";
}

function buildPaymentMethodRows(
  parts: {
    id: string;
    method: string;
    amount: Prisma.Decimal;
    chequeNumber: string | null;
    chequeBank: string | null;
    chequeDate: Date | null;
    bankReference: string | null;
    cardReference: string | null;
    createdAt: Date;
    paymentId: string;
  }[],
  methodAllocationSource: {
    invoiceNumber: string;
    amount: Prisma.Decimal;
  }[],
) {
  let allocationIndex = 0;
  let currentAllocationRemaining =
    methodAllocationSource[allocationIndex]?.amount ?? new Prisma.Decimal(0);

  return parts.map((part) => {
    let partRemaining = part.amount;
    const allocations: {
      invoiceNumber: string;
      amount: Prisma.Decimal;
    }[] = [];

    while (
      partRemaining.gt(0) &&
      allocationIndex < methodAllocationSource.length
    ) {
      const allocation = methodAllocationSource[allocationIndex];
      const allocatedAmount = minDecimal(
        partRemaining,
        currentAllocationRemaining,
      );

      if (allocatedAmount.gt(0)) {
        allocations.push({
          invoiceNumber: allocation.invoiceNumber,
          amount: allocatedAmount,
        });
      }

      partRemaining = partRemaining.minus(allocatedAmount);
      currentAllocationRemaining =
        currentAllocationRemaining.minus(allocatedAmount);

      if (currentAllocationRemaining.equals(0)) {
        allocationIndex += 1;
        currentAllocationRemaining =
          methodAllocationSource[allocationIndex]?.amount ??
          new Prisma.Decimal(0);
      }
    }

    return {
      ...part,
      details: getMethodDetails(part),
      allocations,
    };
  });
}

export default async function PaymentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          code: true,
          name: true,
          phone: true,
          area: true,
          routeName: true,
        },
      },
      parts: {
        orderBy: { createdAt: "asc" },
      },
      allocations: {
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              amount: true,
              invoiceDate: true,
              dueDate: true,
              status: true,
              payments: {
                select: {
                  paymentId: true,
                  amount: true,
                  payment: {
                    select: {
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!payment) {
    notFound();
  }

  const methodAllocationSource = payment.allocations.map((allocation) => ({
    invoiceNumber: allocation.invoice.invoiceNumber,
    amount: allocation.amount,
  }));
  const paymentMethods = buildPaymentMethodRows(
    payment.parts,
    methodAllocationSource,
  );

  const allocationsByInvoice = new Map<
    string,
    {
      invoiceNumber: string;
      invoiceTotal: Prisma.Decimal;
      amountPaid: Prisma.Decimal;
      outstandingBefore: Prisma.Decimal;
      outstandingAfter: Prisma.Decimal;
      statusAfterPayment: string;
    }
  >();

  for (const allocation of payment.allocations) {
    const existing = allocationsByInvoice.get(allocation.invoice.id);
    const amountPaid = (existing?.amountPaid ?? new Prisma.Decimal(0)).plus(
      allocation.amount,
    );
    const previousAllocations = allocation.invoice.payments
      .filter((invoiceAllocation) => {
        return (
          invoiceAllocation.paymentId !== payment.id &&
          invoiceAllocation.payment.createdAt < payment.createdAt
        );
      })
      .map((invoiceAllocation) => invoiceAllocation.amount);
    const outstandingBefore = allocation.invoice.amount.minus(
      sumDecimals(previousAllocations),
    );
    const outstandingAfter = outstandingBefore.minus(amountPaid);
    const statusAfterPayment = outstandingAfter.lte(0)
      ? "PAID"
      : outstandingAfter.lt(allocation.invoice.amount)
        ? "PARTIALLY_PAID"
        : "UNPAID";

    allocationsByInvoice.set(allocation.invoice.id, {
      invoiceNumber: allocation.invoice.invoiceNumber,
      invoiceTotal: allocation.invoice.amount,
      amountPaid,
      outstandingBefore,
      outstandingAfter,
      statusAfterPayment,
    });
  }

  const invoiceAllocations = Array.from(allocationsByInvoice.values());
  const paymentStatus = getPaymentStatus(payment) ?? "ACTIVE";
  const paymentNumber = getPaymentNumber(payment);
  const paymentReference = paymentNumber ?? formatPaymentReference(payment);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight">
                  Payment Details
                </h1>
                <StatusBadge status={paymentStatus} />
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 font-mono text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-500/20">
                  {paymentReference}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-zinc-700">
                {payment.customer.name} ({payment.customer.code})
              </p>
            </div>
            <div className="flex flex-col gap-3 print:hidden sm:flex-row">
              <PrintReceiptButton />
              <Link
                href="/payments"
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
              >
                Back to Payments
              </Link>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-t border-zinc-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Payment Number" value={paymentReference} />
            <DetailItem label="Customer Name" value={payment.customer.name} />
            <DetailItem label="Customer Code" value={payment.customer.code} />
            <DetailItem
              label="Payment Date"
              value={formatDate(payment.paymentDate)}
            />
            <DetailItem
              label="Total Amount"
              value={formatAmount(payment.amount)}
            />
            <DetailItem label="Payment Method" value={payment.paymentMethod} />
            <DetailItem label="Area" value={payment.customer.area ?? "-"} />
            <DetailItem
              label="Route"
              value={payment.customer.routeName ?? "-"}
            />
            <DetailItem label="Created" value={formatDate(payment.createdAt)} />
          </dl>
          {payment.notes && (
            <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase text-zinc-500">
                Notes
              </p>
              <p className="mt-1 text-sm text-zinc-700">{payment.notes}</p>
            </div>
          )}
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-medium tracking-tight">
            Payment Methods
          </h2>
          {paymentMethods.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
              No payment method details found.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-zinc-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Method
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Reference / Details
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Allocated Invoices
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {paymentMethods.map((part) => (
                      <tr key={part.id}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950">
                          {formatMethod(part.method)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(part.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {part.details}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {part.allocations.length === 0 ? (
                            "-"
                          ) : (
                            <div className="grid gap-1">
                              {part.allocations.map((allocation) => (
                                <div key={allocation.invoiceNumber}>
                                  Invoice {allocation.invoiceNumber} →{" "}
                                  {formatAmount(allocation.amount)}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-medium tracking-tight">
            Invoice Allocations
          </h2>
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            Outstanding after payment shows the balance remaining immediately
            after this payment was recorded.
          </div>
          {invoiceAllocations.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
              No invoice allocations found.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-zinc-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Invoice Number
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Invoice Total
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Outstanding Before
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Paid In This Payment
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Outstanding After
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Status After Payment
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {invoiceAllocations.map((allocation) => (
                      <tr key={allocation.invoiceNumber}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950">
                          {allocation.invoiceNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(allocation.invoiceTotal)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(allocation.outstandingBefore)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(allocation.amountPaid)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(allocation.outstandingAfter)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={allocation.statusAfterPayment} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-zinc-950">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusBadgeClass(
        status,
      )}`}
    >
      {formatStatus(status)}
    </span>
  );
}
