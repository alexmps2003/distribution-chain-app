import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api-client";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type InvoiceDetailsResponse = {
  invoice: {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    amount: string | number;
  };
  customer: {
    code: string;
    name: string;
  };
  allocations: {
    id: string;
    amount: string | number;
    payment: {
      id: string;
      paymentDate: string;
    };
    paymentPart: {
      method: string;
      status: string;
      chequeNumber: string | null;
      chequeBank: string | null;
      chequeDate: string | null;
      bankReference: string | null;
      cardReference: string | null;
    } | null;
  }[];
  activePaidAmount: string | number;
  outstanding: string | number;
  displayStatus: string;
};

function formatAmount(value: string | number) {
  return numberFormatter.format(Number(value.toString()));
}

function formatDate(date: Date | null) {
  if (!date) return "-";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStatus(status: string) {
  return status.replace("_", " ");
}

function getStatusBadgeClass(status: string) {
  if (status === "ACTIVE" || status === "PAID") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "REVERSED" || status === "UNPAID") {
    return "bg-rose-100 text-rose-800";
  }

  if (status === "PARTIALLY_PAID") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-zinc-200 text-zinc-800";
}

function getPaymentPartStatus(status: string | null | undefined) {
  return status ?? "ACTIVE";
}

function getMethodDetails(allocation: {
  paymentPart: {
    method: string;
    chequeNumber: string | null;
    chequeBank: string | null;
    chequeDate: string | null;
    bankReference: string | null;
    cardReference: string | null;
  } | null;
}) {
  const part = allocation.paymentPart;

  if (!part) {
    return "-";
  }

  if (part.method === "CHEQUE") {
    return [
      part.chequeNumber ? `Cheque #${part.chequeNumber}` : "",
      part.chequeBank ? `Bank: ${part.chequeBank}` : "",
      part.chequeDate ? formatDate(new Date(part.chequeDate)) : "",
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-zinc-950">{value}</dd>
    </div>
  );
}

export default async function InvoiceDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    customerId?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const { id } = await params;
  const { customerId, returnTo } = await searchParams;
  const selectedReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const selectedCustomerId = Array.isArray(customerId)
    ? customerId[0]
    : customerId;

  const backHref =
    selectedReturnTo &&
    selectedReturnTo.startsWith("/") &&
    !selectedReturnTo.startsWith("//")
      ? selectedReturnTo
      : selectedCustomerId
        ? `/invoices?customerId=${encodeURIComponent(selectedCustomerId)}`
        : "/invoices";
  let invoiceDetails: InvoiceDetailsResponse | null;

  try {
    invoiceDetails = await apiGet<InvoiceDetailsResponse | null>(
      `/invoices/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("failed with 404")) {
      notFound();
    }

    throw error;
  }

  if (!invoiceDetails) {
    notFound();
  }

  const {
    activePaidAmount,
    allocations,
    customer,
    displayStatus,
    invoice,
    outstanding: outstandingAmount,
  } = invoiceDetails;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">
            Invoice Details
          </h1>
          <Link
            href={backHref}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
          >
            Back to Invoices
          </Link>
        </div>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-medium tracking-tight">
                Invoice Summary
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Invoice {invoice.invoiceNumber}
              </p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${getStatusBadgeClass(
                displayStatus,
              )}`}
            >
              {formatStatus(displayStatus)}
            </span>
          </div>

          <dl className="mt-6 grid gap-4 border-t border-zinc-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Invoice Number" value={invoice.invoiceNumber} />
            <DetailItem
              label="Customer"
              value={`${customer.name} (${customer.code})`}
            />
            <DetailItem
              label="Invoice Date"
              value={formatDate(new Date(invoice.invoiceDate))}
            />
            <DetailItem
              label="Due Date"
              value={formatDate(
                invoice.dueDate ? new Date(invoice.dueDate) : null,
              )}
            />
            <DetailItem
              label="Invoice Total"
              value={formatAmount(invoice.amount)}
            />
            <DetailItem
              label="Paid Amount"
              value={formatAmount(activePaidAmount)}
            />
            <DetailItem
              label="Outstanding Amount"
              value={formatAmount(outstandingAmount)}
            />
            <DetailItem label="Status" value={formatStatus(displayStatus)} />
          </dl>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-medium tracking-tight">
            Payment History
          </h2>

          {allocations.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
              No payment allocations found for this invoice.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-zinc-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Payment Date
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Payment Receipt
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Method
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Reference / Details
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Payment Part Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {allocations.map((allocation) => {
                      const partStatus = getPaymentPartStatus(
                        allocation.paymentPart?.status,
                      );

                      return (
                        <tr key={allocation.id}>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                            {formatDate(
                              new Date(allocation.payment.paymentDate),
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Link
                              href={`/payments/${allocation.payment.id}`}
                              className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                            >
                              Receipt
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950">
                            {formatStatus(
                              allocation.paymentPart?.method ?? "LEGACY",
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {getMethodDetails(allocation)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                            {formatAmount(allocation.amount)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(
                                partStatus,
                              )}`}
                            >
                              {formatStatus(partStatus)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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
