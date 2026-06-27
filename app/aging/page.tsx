import Link from "next/link";
import { Clock3 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { apiGet } from "@/lib/api-client";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const bucketOrder = [
  "notDue",
  "days0To30",
  "days31To60",
  "days61To90",
  "days90Plus",
  "noDueDate",
] as const;

type BucketKey = (typeof bucketOrder)[number];

type MoneyValue = string | number;

type AgingReportResponse = {
  summary: {
    totalOutstanding: MoneyValue;
    overdueOutstanding: MoneyValue;
    ninetyPlusOutstanding: MoneyValue;
    overdueInvoiceCount: number;
  };
  buckets: {
    name: string;
    totalOutstanding: MoneyValue;
    invoiceCount: number;
  }[];
  invoices: {
    invoice: {
      id: string;
      invoiceNumber: string;
    };
    customer: {
      area: string | null;
      code: string;
      id: string;
      name: string;
      routeName: string | null;
    };
    amount: MoneyValue;
    activePaidAmount: MoneyValue;
    outstanding: MoneyValue;
    dueDate: string | null;
    daysOverdue: number | null;
    bucket: string;
    status: string;
  }[];
};

const bucketLabels: Record<BucketKey, string> = {
  days0To30: "0-30 days overdue",
  days31To60: "31-60 days overdue",
  days61To90: "61-90 days overdue",
  days90Plus: "90+ days overdue",
  noDueDate: "No Due Date",
  notDue: "Not Due",
};

function formatAmount(value: MoneyValue) {
  return numberFormatter.format(Number(String(value)));
}

function formatDate(date: Date | null) {
  if (!date) return "-";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusBadgeClass(status: string) {
  if (status === "PARTIALLY_PAID") {
    return "bg-amber-50 text-amber-700 ring-amber-600/20";
  }

  if (status === "UNPAID") {
    return "bg-red-50 text-red-700 ring-red-600/20";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-500/20";
}

function getBucketKey(label: string): BucketKey {
  return (
    (Object.entries(bucketLabels).find(
      ([, bucketLabel]) => bucketLabel === label,
    )?.[0] as BucketKey | undefined) ?? "noDueDate"
  );
}

function createEmptyBuckets() {
  return {
    days0To30: "0.00",
    days31To60: "0.00",
    days61To90: "0.00",
    days90Plus: "0.00",
    noDueDate: "0.00",
    notDue: "0.00",
  } satisfies Record<BucketKey, MoneyValue>;
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

function addAmounts(left: MoneyValue, right: MoneyValue) {
  return fromCents(toCents(left) + toCents(right));
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03]">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-medium tracking-tight text-zinc-950">
        {value}
      </p>
    </div>
  );
}

export default async function AgingPage() {
  const report = await apiGet<AgingReportResponse>("/aging");
  const outstandingInvoices = report.invoices.map((row) => ({
    amount: row.amount,
    bucket: getBucketKey(row.bucket),
    customer: row.customer,
    daysOverdue: row.daysOverdue,
    dueDate: row.dueDate ? new Date(row.dueDate) : null,
    id: row.invoice.id,
    invoiceNumber: row.invoice.invoiceNumber,
    outstandingAmount: row.outstanding,
    paidAmount: row.activePaidAmount,
    status: row.status,
  }));

  const customerRowsById = new Map<
    string,
    {
      area: string | null;
      buckets: Record<BucketKey, MoneyValue>;
      code: string;
      id: string;
      name: string;
      routeName: string | null;
      totalOutstanding: MoneyValue;
    }
  >();

  for (const invoice of outstandingInvoices) {
    const existing = customerRowsById.get(invoice.customer.id) ?? {
      area: invoice.customer.area,
      buckets: createEmptyBuckets(),
      code: invoice.customer.code,
      id: invoice.customer.id,
      name: invoice.customer.name,
      routeName: invoice.customer.routeName,
      totalOutstanding: "0.00",
    };

    existing.buckets[invoice.bucket] = addAmounts(
      existing.buckets[invoice.bucket],
      invoice.outstandingAmount,
    );
    existing.totalOutstanding = addAmounts(
      existing.totalOutstanding,
      invoice.outstandingAmount,
    );
    customerRowsById.set(invoice.customer.id, existing);
  }

  const customerRows = Array.from(customerRowsById.values()).sort((left, right) => {
    return toCents(right.totalOutstanding) - toCents(left.totalOutstanding);
  });
  const totalOutstanding = report.summary.totalOutstanding;
  const overdueOutstanding = report.summary.overdueOutstanding;
  const days90PlusOutstanding = report.summary.ninetyPlusOutstanding;
  const overdueInvoiceCount = report.summary.overdueInvoiceCount;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-9">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">
            Aging Report
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            See which customer balances are current, recently overdue, or
            seriously overdue.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total Outstanding"
            value={formatAmount(totalOutstanding)}
          />
          <SummaryCard
            label="Overdue Outstanding"
            value={formatAmount(overdueOutstanding)}
          />
          <SummaryCard
            label="90+ Days Outstanding"
            value={formatAmount(days90PlusOutstanding)}
          />
          <SummaryCard
            label="Overdue Invoice Count"
            value={overdueInvoiceCount}
          />
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-sm shadow-zinc-950/[0.03]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-medium tracking-tight">
                Customer Aging Summary
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Outstanding balances grouped by invoice due date.
              </p>
            </div>
          </div>

          {customerRows.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={Clock3}
                title="Nothing overdue"
                description="There are currently no outstanding invoices to analyse."
              />
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200/80">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                    <tr>
                      <th scope="col" className="px-4 py-3.5">
                        Customer
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Code
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Area
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Route
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Not Due
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        0-30
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        31-60
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        61-90
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        90+
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        No Due Date
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Total Outstanding
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {customerRows.map((customer) => {
                      const href = `/outstanding?customerId=${customer.id}`;

                      return (
                        <tr
                          key={customer.id}
                          className="transition-colors hover:bg-zinc-50/80"
                        >
                          <td className="whitespace-nowrap font-medium">
                            <Link
                              href={href}
                              className="block px-4 py-4 font-medium text-zinc-950"
                            >
                              {customer.name}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap text-zinc-600">
                            <Link href={href} className="block px-4 py-4">
                              {customer.code}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap text-zinc-600">
                            <Link href={href} className="block px-4 py-4">
                              {customer.area ?? "-"}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap text-zinc-600">
                            <Link href={href} className="block px-4 py-4">
                              {customer.routeName ?? "-"}
                            </Link>
                          </td>
                          {bucketOrder.map((bucket) => (
                            <td
                              key={bucket}
                              className="whitespace-nowrap text-right font-medium text-zinc-600"
                            >
                              <Link href={href} className="block px-4 py-4">
                                {formatAmount(customer.buckets[bucket])}
                              </Link>
                            </td>
                          ))}
                          <td className="whitespace-nowrap text-right font-medium text-zinc-950">
                            <Link href={href} className="block px-4 py-4">
                              {formatAmount(customer.totalOutstanding)}
                            </Link>
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

        <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-sm shadow-zinc-950/[0.03]">
          <div>
            <h2 className="text-lg font-medium tracking-tight">
              Invoice Aging Detail
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Invoice-level view of unpaid balances and their aging buckets.
            </p>
          </div>

          {outstandingInvoices.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={Clock3}
                title="Nothing overdue"
                description="There are currently no outstanding invoices to analyse."
              />
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200/80">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                    <tr>
                      <th scope="col" className="px-4 py-3.5">
                        Invoice Number
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Customer
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Due Date
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Days Overdue
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Bucket
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Invoice Total
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Paid Amount
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Outstanding Amount
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {outstandingInvoices.map((invoice) => {
                      const href = `/invoices/${invoice.id}?returnTo=${encodeURIComponent(
                        "/aging",
                      )}`;

                      return (
                        <tr
                          key={invoice.id}
                          className="transition-colors hover:bg-zinc-50/80"
                        >
                          <td className="whitespace-nowrap font-medium">
                            <Link
                              href={href}
                              className="block px-4 py-4 font-medium text-zinc-950"
                            >
                              {invoice.invoiceNumber}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap text-zinc-600">
                            <Link href={href} className="block px-4 py-4">
                              {invoice.customer.name}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap text-zinc-600">
                            <Link href={href} className="block px-4 py-4">
                              {formatDate(invoice.dueDate)}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                            <Link href={href} className="block px-4 py-4">
                              {invoice.daysOverdue === null
                                ? "-"
                                : Math.max(invoice.daysOverdue, 0)}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap">
                            <Link href={href} className="block px-4 py-4">
                              {bucketLabels[invoice.bucket]}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                            <Link href={href} className="block px-4 py-4">
                              {formatAmount(invoice.amount)}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                            <Link href={href} className="block px-4 py-4">
                              {formatAmount(invoice.paidAmount)}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap text-right font-medium text-zinc-950">
                            <Link href={href} className="block px-4 py-4">
                              {formatAmount(invoice.outstandingAmount)}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap">
                            <Link href={href} className="block px-4 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getStatusBadgeClass(
                                  invoice.status,
                                )}`}
                              >
                                {invoice.status.replace("_", " ")}
                              </span>
                            </Link>
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
