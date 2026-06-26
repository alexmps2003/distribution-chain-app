import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { notFound } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import {
  getOutstandingReport,
  sumDecimals,
} from "@/lib/outstanding-report";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

function getStatusBadgeClass(status: string) {
  if (status === "PAID") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "PARTIALLY_PAID") {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "UNPAID") {
    return "bg-rose-100 text-rose-800";
  }

  return "bg-zinc-200 text-zinc-800";
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
        {value}
      </p>
    </div>
  );
}

export default async function OutstandingPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const { customerRows, customers } = await getOutstandingReport();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalOutstanding = sumDecimals(
    customerRows.map((customer) => customer.totalOutstanding),
  );
  const overdueInvoiceCount = customerRows.reduce((count, customer) => {
    return (
      count +
      customer.outstandingInvoices.filter((invoice) => {
        return invoice.dueDate !== null && invoice.dueDate < today;
      }).length
    );
  }, 0);
  const highestOutstandingCustomer = [...customerRows].sort((left, right) => {
    return right.totalOutstanding.comparedTo(left.totalOutstanding);
  })[0];

  if (customerId) {
    const customer = customerRows.find((row) => row.id === customerId);

    if (!customer) {
      const existingCustomer = customers.find((row) => row.id === customerId);

      if (!existingCustomer) {
        notFound();
      }

      return (
        <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Outstanding Invoices for {existingCustomer.name}
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Customer code: {existingCustomer.code}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/outstanding/export?customerId=${existingCustomer.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Export CSV
                </Link>
                <Link
                  href="/outstanding"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
                >
                  Back to Outstanding
                </Link>
              </div>
            </div>
            <EmptyState
              icon={CircleCheck}
              title="No outstanding balances"
              description="All invoices are fully paid for this customer."
            />
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Outstanding Invoices for {customer.name}
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Customer code: {customer.code}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/outstanding/export?customerId=${customer.id}`}
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Export CSV
              </Link>
              <Link
                href="/outstanding"
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
              >
                Back to Outstanding
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Invoice Number
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Invoice Date
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Due Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Invoice Total
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Paid Amount
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Outstanding Amount
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {customer.outstandingInvoices.map((invoice) => {
                    const invoiceHref = `/invoices/${invoice.id}?returnTo=${encodeURIComponent(
  `/outstanding?customerId=${customer.id}`,
)}`;

                    return (
                      <tr key={invoice.id} className="hover:bg-zinc-50">
                        <td className="whitespace-nowrap font-medium">
                          <Link
                            href={invoiceHref}
                            className="block px-4 py-3 font-semibold text-zinc-950"
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-zinc-600">
                          <Link href={invoiceHref} className="block px-4 py-3">
                            {formatDate(invoice.invoiceDate)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-zinc-600">
                          <Link href={invoiceHref} className="block px-4 py-3">
                            {formatDate(invoice.dueDate)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                          <Link href={invoiceHref} className="block px-4 py-3">
                            {formatAmount(invoice.amount)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                          <Link href={invoiceHref} className="block px-4 py-3">
                            {formatAmount(invoice.paidAmount)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                          <Link href={invoiceHref} className="block px-4 py-3">
                            {formatAmount(invoice.outstandingAmount)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap">
                          <Link href={invoiceHref} className="block px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(
                                invoice.displayStatus,
                              )}`}
                            >
                              {invoice.displayStatus.replace("_", " ")}
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
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Customer Outstanding
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Customers with invoice balances still due.
            </p>
          </div>
          <Link
            href="/outstanding/export"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Export CSV
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Customers With Outstanding"
            value={customerRows.length}
          />
          <SummaryCard
            label="Total Outstanding"
            value={formatAmount(totalOutstanding)}
          />
          <SummaryCard label="Overdue Invoices" value={overdueInvoiceCount} />
          <SummaryCard
            label="Highest Outstanding Customer"
            value={
              highestOutstandingCustomer
                ? `${highestOutstandingCustomer.name} (${formatAmount(
                    highestOutstandingCustomer.totalOutstanding,
                  )})`
                : "-"
            }
          />
        </section>

        {customerRows.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title="No outstanding balances"
            description="All invoices are fully paid."
          />
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Customer Code
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Area
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Route
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Outstanding Invoice Count
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Total Outstanding
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Oldest Due Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {customerRows.map((customer) => {
                    const customerHref = `/outstanding?customerId=${customer.id}`;

                    return (
                      <tr key={customer.id} className="hover:bg-zinc-50">
                        <td className="whitespace-nowrap font-medium">
                          <Link
                            href={customerHref}
                            className="block px-4 py-3 font-semibold text-zinc-950"
                          >
                            {customer.name}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-zinc-600">
                          <Link
                            href={customerHref}
                            className="block px-4 py-3"
                          >
                            {customer.code}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-zinc-600">
                          <Link
                            href={customerHref}
                            className="block px-4 py-3"
                          >
                            {customer.area ?? "-"}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-zinc-600">
                          <Link
                            href={customerHref}
                            className="block px-4 py-3"
                          >
                            {customer.routeName ?? "-"}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                          <Link
                            href={customerHref}
                            className="block px-4 py-3"
                          >
                            {customer.outstandingInvoices.length}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                          <Link
                            href={customerHref}
                            className="block px-4 py-3"
                          >
                            {formatAmount(customer.totalOutstanding)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-zinc-600">
                          <Link
                            href={customerHref}
                            className="block px-4 py-3"
                          >
                            {formatDate(customer.oldestDueDate)}
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
      </div>
    </main>
  );
}
