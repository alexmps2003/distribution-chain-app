import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { notFound } from "next/navigation";
import PageContainer from "@/components/distribio/PageContainer";
import PageHeader from "@/components/distribio/PageHeader";
import StatCard from "@/components/distribio/StatCard";
import StatsGrid from "@/components/distribio/StatsGrid";
import {
  brandPrimaryButtonClassName,
  brandSecondaryButtonClassName,
} from "@/components/distribio/brand";
import EmptyState from "@/components/EmptyState";
import { apiGet } from "@/lib/api-client-server";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type MoneyValue = string | number;

type OutstandingCustomer = {
  area: string | null;
  code: string;
  id: string;
  name: string;
  routeName: string | null;
};

type OutstandingInvoice = {
  amount: MoneyValue;
  dueDate: string | null;
  id: string;
  invoiceDate: string;
  invoiceNumber: string;
};

type OutstandingInvoiceSummary = OutstandingInvoice & {
  activePaidAmount: MoneyValue;
  displayStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  outstanding?: MoneyValue;
};

type GeneralOutstandingResponse = {
  summary: {
    customerCount: number;
    totalOutstanding: MoneyValue;
    overdueInvoiceCount: number;
    highestOutstandingCustomer:
      | (OutstandingCustomer & { totalOutstanding: MoneyValue })
      | null;
  };
  customers: {
    customer: OutstandingCustomer;
    totalOutstanding: MoneyValue;
    outstandingInvoiceCount: number;
    oldestDueDate: string | null;
    invoices: OutstandingInvoiceSummary[];
  }[];
};

type CustomerOutstandingResponse = {
  customer: OutstandingCustomer;
  summary: {
    totalOutstanding: MoneyValue;
    outstandingInvoiceCount: number;
    oldestDueDate: string | null;
  };
  invoices: {
    invoice: OutstandingInvoice;
    activePaidAmount: MoneyValue;
    outstanding: MoneyValue;
    displayStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
    daysOverdue: number | null;
  }[];
};

function formatAmount(value: MoneyValue) {
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

export default async function OutstandingPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;

  if (customerId) {
    let report: CustomerOutstandingResponse;

    try {
      report = await apiGet<CustomerOutstandingResponse>(
        `/outstanding?customerId=${encodeURIComponent(customerId)}`,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("failed with 404")) {
        notFound();
      }

      throw error;
    }

    const customer = {
      ...report.customer,
      oldestDueDate: report.summary.oldestDueDate
        ? new Date(report.summary.oldestDueDate)
        : null,
      outstandingInvoices: report.invoices.map(
        ({ activePaidAmount, displayStatus, invoice, outstanding }) => ({
          ...invoice,
          displayStatus,
          dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
          invoiceDate: new Date(invoice.invoiceDate),
          outstandingAmount: outstanding,
          paidAmount: activePaidAmount,
        }),
      ),
      totalOutstanding: report.summary.totalOutstanding,
    };

    if (customer.outstandingInvoices.length === 0) {
      return (
        <PageContainer>
          <PageHeader
            eyebrow="Distribio outstanding"
            title={`Outstanding Invoices for ${customer.name}`}
            subtitle={`Customer code: ${customer.code}. Review unpaid and partially paid invoices for this customer.`}
            actions={
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/outstanding/export?customerId=${customer.id}`}
                  className={brandPrimaryButtonClassName}
                >
                  Export CSV
                </Link>
                <Link
                  href="/outstanding"
                  className={brandSecondaryButtonClassName}
                >
                  Back to Outstanding
                </Link>
              </div>
            }
          />
          <EmptyState
            icon={CircleCheck}
            title="No outstanding balances"
            description="All invoices are fully paid for this customer."
          />
        </PageContainer>
      );
    }

    return (
      <PageContainer>
        <PageHeader
          eyebrow="Distribio outstanding"
          title={`Outstanding Invoices for ${customer.name}`}
          subtitle={`Customer code: ${customer.code}. Review unpaid and partially paid invoices for this customer.`}
          actions={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/outstanding/export?customerId=${customer.id}`}
                className={brandPrimaryButtonClassName}
              >
                Export CSV
              </Link>
              <Link
                href="/outstanding"
                className={brandSecondaryButtonClassName}
              >
                Back to Outstanding
              </Link>
            </div>
          }
        />

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
      </PageContainer>
    );
  }

  const report = await apiGet<GeneralOutstandingResponse>("/outstanding");
  const customerRows = report.customers.map((row) => ({
    ...row.customer,
    oldestDueDate: row.oldestDueDate ? new Date(row.oldestDueDate) : null,
    outstandingInvoiceCount: row.outstandingInvoiceCount,
    totalOutstanding: row.totalOutstanding,
  }));
  const customerCount = report.summary.customerCount;
  const totalOutstanding = report.summary.totalOutstanding;
  const overdueInvoiceCount = report.summary.overdueInvoiceCount;
  const highestOutstandingCustomer = report.summary.highestOutstandingCustomer;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Distribio outstanding"
        title="Customer Outstanding"
        subtitle="Customers with invoice balances still due, including overdue exposure and oldest due dates."
        actions={
          <Link
            href="/outstanding/export"
            className={brandPrimaryButtonClassName}
          >
            Export CSV
          </Link>
        }
      />

      <StatsGrid>
        <StatCard title="Customers With Outstanding" value={customerCount} />
        <StatCard
          title="Total Outstanding"
          value={formatAmount(totalOutstanding)}
        />
        <StatCard title="Overdue Invoices" value={overdueInvoiceCount} />
        <StatCard
          title="Highest Outstanding Customer"
          value={
            highestOutstandingCustomer
              ? `${highestOutstandingCustomer.name} (${formatAmount(
                  highestOutstandingCustomer.totalOutstanding,
                )})`
              : "-"
          }
        />
      </StatsGrid>

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
                        <Link href={customerHref} className="block px-4 py-3">
                          {customer.code}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-zinc-600">
                        <Link href={customerHref} className="block px-4 py-3">
                          {customer.area ?? "-"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-zinc-600">
                        <Link href={customerHref} className="block px-4 py-3">
                          {customer.routeName ?? "-"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                        <Link href={customerHref} className="block px-4 py-3">
                          {customer.outstandingInvoiceCount}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                        <Link href={customerHref} className="block px-4 py-3">
                          {formatAmount(customer.totalOutstanding)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-zinc-600">
                        <Link href={customerHref} className="block px-4 py-3">
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
    </PageContainer>
  );
}
