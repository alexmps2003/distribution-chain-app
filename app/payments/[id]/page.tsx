import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import PrintReceiptButton from "./PrintReceiptButton";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type MoneyValue = string | number;

type PaymentPart = {
  id: string;
  method: string;
  amount: MoneyValue;
  chequeNumber: string | null;
  chequeBank: string | null;
  chequeDate: string | null;
  bankReference: string | null;
  cardReference: string | null;
  createdAt: string;
  paymentId: string;
};

type PaymentAllocation = {
  id: string;
  amount: MoneyValue;
  paymentPartId: string | null;
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: MoneyValue;
  } | null;
  paymentPart: PaymentPart | null;
};

type PaymentDetailsResponse = {
  payment: {
    id: string;
    paymentDate: string;
    amount: MoneyValue;
    paymentMethod: string;
    notes: string | null;
    createdAt: string;
    status?: string;
    paymentNumber?: string;
  };
  receiptReference?: string;
  customer: {
    code: string;
    name: string;
    phone: string | null;
    area: string | null;
    routeName: string | null;
  } | null;
  parts: PaymentPart[];
  allocations: PaymentAllocation[];
};

function formatAmount(value: MoneyValue) {
  return `LKR ${numberFormatter.format(Number(String(value)))}`;
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

function toCents(value: MoneyValue) {
  const text = String(value);
  const sign = text.startsWith("-") ? -1 : 1;
  const [wholePart, fractionPart = ""] = text.replace("-", "").split(".");
  const wholeCents = Number(wholePart || "0") * 100;
  const fractionCents = Number(fractionPart.padEnd(2, "0").slice(0, 2));

  return sign * (wholeCents + fractionCents);
}

function fromCents(value: number) {
  const sign = value < 0 ? "-" : "";
  const absoluteValue = Math.abs(value);
  const whole = Math.floor(absoluteValue / 100);
  const fraction = String(absoluteValue % 100).padStart(2, "0");

  return `${sign}${whole}.${fraction}`;
}

function sumAmounts(values: MoneyValue[]) {
  const totalCents = values.reduce<number>((total, value) => {
    return total + toCents(value);
  }, 0);

  return fromCents(totalCents);
}

function getMethodDetails(part: {
  method: string;
  chequeNumber: string | null;
  chequeBank: string | null;
  chequeDate: string | null;
  bankReference: string | null;
  cardReference: string | null;
}) {
  if (part.method === "CHEQUE") {
    return [
      part.chequeNumber ? `Cheque #${part.chequeNumber}` : "",
      part.chequeBank ? `Bank: ${part.chequeBank}` : "",
      part.chequeDate ? formatDate(new Date(part.chequeDate)) : "",
    ].filter(Boolean);
  }

  if (part.method === "BANK_TRANSFER") {
    return [part.bankReference ? `Ref: ${part.bankReference}` : "-"];
  }

  if (part.method === "CARD") {
    return [part.cardReference ? `Ref: ${part.cardReference}` : "-"];
  }

  return ["-"];
}

function formatStatus(status: string) {
  if (status === "ACTIVE") {
    return "COMPLETED";
  }

  return status;
}

function formatPrintStatus(status: string) {
  if (status === "PARTIALLY_PAID") {
    return "PARTIAL";
  }

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
    amount: MoneyValue;
    chequeNumber: string | null;
    chequeBank: string | null;
    chequeDate: string | null;
    bankReference: string | null;
    cardReference: string | null;
    createdAt: string;
    paymentId: string;
    allocations: {
      amount: MoneyValue;
      invoice: {
        invoiceNumber: string;
      };
    }[];
  }[],
  methodAllocationSource: {
    invoiceNumber: string;
    amount: MoneyValue;
  }[],
) {
  let allocationIndex = 0;
  let currentAllocationRemaining = toCents(
    methodAllocationSource[allocationIndex]?.amount ?? 0,
  );

  return parts.map((part) => {
    let partRemaining = toCents(part.amount);
    let allocations = part.allocations.map((allocation) => ({
      invoiceNumber: allocation.invoice.invoiceNumber,
      amount: allocation.amount,
    }));

    if (allocations.length === 0) {
      allocations = [];

      while (
        partRemaining > 0 &&
        allocationIndex < methodAllocationSource.length
      ) {
        const allocation = methodAllocationSource[allocationIndex];
        const allocatedAmount = Math.min(partRemaining, currentAllocationRemaining);

        if (allocatedAmount > 0) {
          allocations.push({
            invoiceNumber: allocation.invoiceNumber,
            amount: fromCents(allocatedAmount),
          });
        }

        partRemaining -= allocatedAmount;
        currentAllocationRemaining -= allocatedAmount;

        if (currentAllocationRemaining === 0) {
          allocationIndex += 1;
          currentAllocationRemaining = toCents(
            methodAllocationSource[allocationIndex]?.amount ?? 0,
          );
        }
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const backHref =
    typeof returnTo === "string" &&
    (returnTo === "/cheques" || returnTo.startsWith("/cheques/"))
      ? returnTo
      : "/payments";
  const backLabel = backHref.startsWith("/cheques")
    ? "Back to Cheques"
    : "Back to Payments";
  let paymentDetails: PaymentDetailsResponse | null;

  try {
    paymentDetails = await apiGet<PaymentDetailsResponse | null>(
      `/payments/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("failed with 404")) {
      notFound();
    }

    throw error;
  }

  if (!paymentDetails || !paymentDetails.customer) {
    notFound();
  }

  const { allocations, customer, parts, receiptReference } = paymentDetails;
  const payment = paymentDetails.payment;
  const paymentDate = new Date(payment.paymentDate);
  const paymentCreatedAt = new Date(payment.createdAt);
  const sortedAllocations = [...allocations].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const sortedParts = [...parts].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const methodAllocationSource = sortedAllocations.map((allocation) => ({
    invoiceNumber: allocation.invoice?.invoiceNumber ?? "-",
    amount: allocation.amount,
  }));
  const paymentMethods = buildPaymentMethodRows(
    sortedParts.map((part) => ({
      ...part,
      allocations: sortedAllocations
        .filter((allocation) => allocation.paymentPart?.id === part.id)
        .map((allocation) => ({
          amount: allocation.amount,
          invoice: {
            invoiceNumber: allocation.invoice?.invoiceNumber ?? "-",
          },
        })),
    })),
    methodAllocationSource,
  );

  const allocationsByInvoice = new Map<
    string,
    {
      invoiceNumber: string;
      invoiceTotal: MoneyValue;
      amountPaid: MoneyValue;
      outstandingBefore: MoneyValue;
      outstandingAfter: MoneyValue;
      statusAfterPayment: string;
    }
  >();

  for (const allocation of sortedAllocations) {
    if (!allocation.invoice) {
      continue;
    }

    const existing = allocationsByInvoice.get(allocation.invoice.id);
    const amountPaid = sumAmounts([
      existing?.amountPaid ?? 0,
      allocation.amount,
    ]);
    const outstandingBefore = existing?.outstandingBefore ?? allocation.invoice.amount;
    const outstandingAfter = fromCents(
      toCents(outstandingBefore) - toCents(amountPaid),
    );
    const statusAfterPayment = toCents(outstandingAfter) <= 0
      ? "PAID"
      : toCents(outstandingAfter) < toCents(allocation.invoice.amount)
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
  const paymentReference =
    paymentNumber ??
    receiptReference ??
    formatPaymentReference({ id: payment.id, paymentDate });
  const paymentNotes = payment.notes?.trim();
  const totalOutstandingAfter = sumAmounts(
    invoiceAllocations.map((allocation) => allocation.outstandingAfter),
  );

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950 print:bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="receipt-summary-card rounded-md border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight print:hidden">
                  Payment Details
                </h1>
                <h1 className="hidden text-2xl font-semibold tracking-tight print:block">
                  Customer Payment Receipt
                </h1>
                <StatusBadge status={paymentStatus} />
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-zinc-950">
                Receipt No: {paymentReference}
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-700">
                {customer.name} ({customer.code})
              </p>
            </div>
            <div className="flex flex-col gap-3 print:hidden sm:flex-row">
              <PrintReceiptButton />
              <Link
                href={backHref}
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
              >
                {backLabel}
              </Link>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-t border-zinc-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Customer Name" value={customer.name} />
            <DetailItem label="Customer Code" value={customer.code} />
            <DetailItem
              label="Payment Date"
              value={formatDate(paymentDate)}
            />
            <DetailItem
              label="Total Amount"
              value={formatAmount(payment.amount)}
            />
            <DetailItem label="Payment Method" value={payment.paymentMethod} />
            <DetailItem label="Area" value={customer.area ?? "-"} />
            <DetailItem
              label="Route"
              value={customer.routeName ?? "-"}
            />
            <DetailItem label="Created" value={formatDate(paymentCreatedAt)} />
          </dl>
          {paymentNotes && (
            <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase text-zinc-500">
                Notes
              </p>
              <p className="mt-1 text-sm text-zinc-700">{paymentNotes}</p>
            </div>
          )}
          <div className="mt-5 hidden rounded-md border border-zinc-300 bg-white p-4 print:block">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Total Outstanding After This Payment
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-950">
              {formatAmount(totalOutstandingAfter)}
            </p>
          </div>
        </section>

        <section className="receipt-methods-section rounded-md border border-zinc-200 bg-white p-6">
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
                        <td className="w-[24%] px-4 py-3 text-zinc-600">
                          <div className="grid gap-1">
                            {part.details.map((detail) => (
                              <div key={detail}>{detail}</div>
                            ))}
                          </div>
                        </td>
                        <td className="w-[40%] px-4 py-3 text-zinc-600">
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

        <section className="receipt-allocations-section rounded-md border border-zinc-200 bg-white p-6">
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
                <table className="receipt-allocations-table min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        <span className="print:hidden">Invoice Number</span>
                        <span className="hidden print:inline">Inv</span>
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        <span className="print:hidden">Invoice Total</span>
                        <span className="hidden print:inline">Total</span>
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        <span className="print:hidden">
                          Outstanding Before
                        </span>
                        <span className="hidden print:inline">Before</span>
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        <span className="print:hidden">
                          Paid In This Payment
                        </span>
                        <span className="hidden print:inline">Paid</span>
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        <span className="print:hidden">
                          Outstanding After
                        </span>
                        <span className="hidden print:inline">After</span>
                      </th>
                      <th scope="col" className="px-4 py-3">
                        <span className="print:hidden">
                          Status After Payment
                        </span>
                        <span className="hidden print:inline">Status</span>
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
                          <StatusBadge
                            status={allocation.statusAfterPayment}
                            printLabel={formatPrintStatus(
                              allocation.statusAfterPayment,
                            )}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="receipt-signatures hidden rounded-md border border-zinc-200 bg-white p-6 print:block">
          <div className="grid gap-8 sm:grid-cols-2">
            <p className="text-sm font-medium text-zinc-950">
              Collector Signature: ____________________
            </p>
            <p className="text-sm font-medium text-zinc-950">
              Customer Signature: ____________________
            </p>
          </div>
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

function StatusBadge({
  printLabel,
  status,
}: {
  printLabel?: string;
  status: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset print:whitespace-nowrap print:px-1.5 print:py-0.5 print:text-[10px] ${getStatusBadgeClass(
        status,
      )}`}
    >
      <span className={printLabel ? "print:hidden" : ""}>
        {formatStatus(status)}
      </span>
      {printLabel && <span className="hidden print:inline">{printLabel}</span>}
    </span>
  );
}
