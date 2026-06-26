import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Clock3 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { prisma } from "@/lib/prisma";

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

const bucketLabels: Record<BucketKey, string> = {
  days0To30: "0-30 days overdue",
  days31To60: "31-60 days overdue",
  days61To90: "61-90 days overdue",
  days90Plus: "90+ days overdue",
  noDueDate: "No Due Date",
  notDue: "Not Due",
};

function formatAmount(value: { toString(): string }) {
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

function sumDecimals(values: Prisma.Decimal[]) {
  return values.reduce(
    (total, value) => total.plus(value),
    new Prisma.Decimal(0),
  );
}

function getActivePaidAmount(payments: {
  amount: Prisma.Decimal;
  paymentPart: { status: string } | null;
}[]) {
  return sumDecimals(
    payments
      .filter((allocation) => {
        return (
          allocation.paymentPart === null ||
          allocation.paymentPart.status === "ACTIVE"
        );
      })
      .map((allocation) => allocation.amount),
  );
}

function getDisplayStatus(invoiceTotal: Prisma.Decimal, paidAmount: Prisma.Decimal) {
  if (paidAmount.gte(invoiceTotal)) {
    return "PAID";
  }

  if (paidAmount.gt(0)) {
    return "PARTIALLY_PAID";
  }

  return "UNPAID";
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

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today;
}

function getDaysOverdue(dueDate: Date | null, today: Date) {
  if (!dueDate) {
    return null;
  }

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
}

function getAgingBucket(daysOverdue: number | null): BucketKey {
  if (daysOverdue === null) {
    return "noDueDate";
  }

  if (daysOverdue < 0) {
    return "notDue";
  }

  if (daysOverdue <= 30) {
    return "days0To30";
  }

  if (daysOverdue <= 60) {
    return "days31To60";
  }

  if (daysOverdue <= 90) {
    return "days61To90";
  }

  return "days90Plus";
}

function createEmptyBuckets() {
  return {
    days0To30: new Prisma.Decimal(0),
    days31To60: new Prisma.Decimal(0),
    days61To90: new Prisma.Decimal(0),
    days90Plus: new Prisma.Decimal(0),
    noDueDate: new Prisma.Decimal(0),
    notDue: new Prisma.Decimal(0),
  } satisfies Record<BucketKey, Prisma.Decimal>;
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
  const invoices = await prisma.invoice.findMany({
    include: {
      customer: {
        select: {
          area: true,
          code: true,
          id: true,
          name: true,
          routeName: true,
        },
      },
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
    orderBy: [{ dueDate: "asc" }, { invoiceDate: "asc" }],
  });
  const today = startOfToday();
  const outstandingInvoices = invoices
    .map((invoice) => {
      const paidAmount = getActivePaidAmount(invoice.payments);
      const outstandingAmount = invoice.amount.minus(paidAmount);

      if (outstandingAmount.lte(0)) {
        return null;
      }

      const daysOverdue = getDaysOverdue(invoice.dueDate, today);
      const bucket = getAgingBucket(daysOverdue);

      return {
        amount: invoice.amount,
        bucket,
        customer: invoice.customer,
        daysOverdue,
        dueDate: invoice.dueDate,
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        outstandingAmount,
        paidAmount,
        status: getDisplayStatus(invoice.amount, paidAmount),
      };
    })
    .filter((invoice): invoice is NonNullable<typeof invoice> =>
      Boolean(invoice),
    );

  const customerRowsById = new Map<
    string,
    {
      area: string | null;
      buckets: Record<BucketKey, Prisma.Decimal>;
      code: string;
      id: string;
      name: string;
      routeName: string | null;
      totalOutstanding: Prisma.Decimal;
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
      totalOutstanding: new Prisma.Decimal(0),
    };

    existing.buckets[invoice.bucket] = existing.buckets[invoice.bucket].plus(
      invoice.outstandingAmount,
    );
    existing.totalOutstanding = existing.totalOutstanding.plus(
      invoice.outstandingAmount,
    );
    customerRowsById.set(invoice.customer.id, existing);
  }

  const customerRows = Array.from(customerRowsById.values()).sort((left, right) => {
    return right.totalOutstanding.comparedTo(left.totalOutstanding);
  });
  const totalOutstanding = sumDecimals(
    outstandingInvoices.map((invoice) => invoice.outstandingAmount),
  );
  const overdueInvoices = outstandingInvoices.filter((invoice) => {
    return invoice.daysOverdue !== null && invoice.daysOverdue >= 0;
  });
  const overdueOutstanding = sumDecimals(
    overdueInvoices.map((invoice) => invoice.outstandingAmount),
  );
  const days90PlusOutstanding = sumDecimals(
    outstandingInvoices
      .filter((invoice) => invoice.bucket === "days90Plus")
      .map((invoice) => invoice.outstandingAmount),
  );

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
            value={overdueInvoices.length}
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
