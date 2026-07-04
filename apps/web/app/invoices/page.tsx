import Link from "next/link";
import { FileText, Users } from "lucide-react";
import { notFound } from "next/navigation";
import FilterBar from "@/components/distribio/FilterBar";
import PageContainer from "@/components/distribio/PageContainer";
import PageHeader from "@/components/distribio/PageHeader";
import {
  brandActiveFilterClassName,
  brandInactiveFilterClassName,
  brandPrimaryButtonClassName,
  brandSecondaryButtonClassName,
} from "@/components/distribio/brand";
import EmptyState from "@/components/EmptyState";
import { apiGet } from "@/lib/api-client-server";
import { getAuthenticatedUserServer } from "@/lib/auth-user-server";
import { canCreateCustomer, canCreateInvoice } from "@/lib/permissions";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type InvoiceCustomer = {
  id: string;
  code: string;
  name: string;
};

type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  amount: string | number;
  createdAt: string;
};

type CustomerInvoiceResponse = {
  customer: InvoiceCustomer;
  invoices: {
    invoice: InvoiceRecord;
    activePaidAmount: string | number;
    outstanding: string | number;
    displayStatus: string;
  }[];
};

type CustomerInvoiceSummaryRow = {
  customer: InvoiceCustomer;
  invoiceCount: number;
  totalInvoiced: string | number;
  totalPaid: string | number;
  totalOutstanding: string | number;
  calculatedStatusSummary: {
    PAID: number;
    PARTIALLY_PAID: number;
    UNPAID: number;
  };
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

function getStatusBadgeClass(status: string) {
  if (status === "PAID") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "UNPAID") {
    return "bg-rose-100 text-rose-800";
  }

  if (status === "PARTIALLY_PAID") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-zinc-200 text-zinc-800";
}

const statusFilters = [
  { label: "All", value: "" },
  { label: "Paid", value: "PAID" },
  { label: "Partially Paid", value: "PARTIALLY_PAID" },
  { label: "Unpaid", value: "UNPAID" },
] as const;

function getSelectedStatus(status: string | undefined) {
  if (status === "paid") {
    return "PAID";
  }

  if (status === "partial") {
    return "PARTIALLY_PAID";
  }

  if (status === "unpaid") {
    return "UNPAID";
  }

  if (status === "PAID" || status === "PARTIALLY_PAID" || status === "UNPAID") {
    return status;
  }

  return "";
}

function buildInvoicesHref({
  customerId,
  status,
}: {
  customerId?: string;
  status?: string;
}) {
  const params = new URLSearchParams();

  if (customerId) {
    params.set("customerId", customerId);
  }

  if (status) {
    params.set("status", status);
  }

  const query = params.toString();

  return query ? `/invoices?${query}` : "/invoices";
}

function InvoiceStatusFilters({
  customerId,
  selectedStatus,
}: {
  customerId?: string;
  selectedStatus: string;
}) {
  return (
    <FilterBar>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-zinc-800">Filter by status</p>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            const isSelected = selectedStatus === filter.value;

            return (
              <Link
                key={filter.value || "ALL"}
                href={buildInvoicesHref({
                  customerId,
                  status: filter.value || undefined,
                })}
                className={
                  isSelected
                    ? brandActiveFilterClassName
                    : brandInactiveFilterClassName
                }
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>
    </FilterBar>
  );
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; status?: string }>;
}) {
  const { customerId, status } = await searchParams;
  const selectedStatus = getSelectedStatus(status);
  const authenticatedUser = await getAuthenticatedUserServer();
  const canCreateCustomers = canCreateCustomer(authenticatedUser.role);
  const canCreateInvoices = canCreateInvoice(authenticatedUser.role);

  if (customerId) {
    let invoiceResponse: CustomerInvoiceResponse;

    try {
      invoiceResponse = await apiGet<CustomerInvoiceResponse>(
        `/invoices?customerId=${encodeURIComponent(customerId)}`,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("failed with 404")) {
        notFound();
      }

      throw error;
    }

    const { customer } = invoiceResponse;
    const invoiceRows = invoiceResponse.invoices
      .map(({ activePaidAmount, displayStatus, invoice, outstanding }) => {
        const invoiceHref = `/invoices/${invoice.id}?customerId=${customerId}`;

        return {
          ...invoice,
          displayStatus,
          invoiceHref,
          outstandingAmount: outstanding,
          paidAmount: activePaidAmount,
        };
      })
      .filter((invoice) => {
        return selectedStatus === "" || invoice.displayStatus === selectedStatus;
      });

    return (
      <PageContainer>
        <PageHeader
          eyebrow="Distribio invoices"
          title={`${customer.name} Invoices`}
          subtitle={`Customer code: ${customer.code}. Review invoice status, paid amounts, and outstanding balances.`}
          actions={
            <div className="flex gap-3">
              <Link
                href="/invoices"
                className={brandSecondaryButtonClassName}
              >
                Back to Customers
              </Link>
              {canCreateInvoices ? (
                <Link
                  href="/invoices/new"
                  className={brandPrimaryButtonClassName}
                >
                  New Invoice
                </Link>
              ) : null}
            </div>
          }
        />

          <InvoiceStatusFilters
            customerId={customerId}
            selectedStatus={selectedStatus}
          />

          {invoiceRows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices found"
              description="Create an invoice for this customer or adjust the current status filter."
              actionHref={canCreateInvoices ? "/invoices/new" : undefined}
              actionLabel={canCreateInvoices ? "Create Invoice" : undefined}
            />
          ) : (
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
                      <th scope="col" className="px-4 py-3">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {invoiceRows.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-zinc-50">
                        <td className="whitespace-nowrap font-medium">
                          <Link
                            href={invoice.invoiceHref}
                            className="block px-4 py-3 font-semibold text-zinc-950"
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-zinc-600">
                          <Link
                            href={invoice.invoiceHref}
                            className="block px-4 py-3"
                          >
                            {formatDate(new Date(invoice.invoiceDate))}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-zinc-600">
                          <Link
                            href={invoice.invoiceHref}
                            className="block px-4 py-3"
                          >
                            {formatDate(
                              invoice.dueDate
                                ? new Date(invoice.dueDate)
                                : null,
                            )}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                          <Link
                            href={invoice.invoiceHref}
                            className="block px-4 py-3"
                          >
                            {formatAmount(invoice.amount)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                          <Link
                            href={invoice.invoiceHref}
                            className="block px-4 py-3"
                          >
                            {formatAmount(invoice.paidAmount)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                          <Link
                            href={invoice.invoiceHref}
                            className="block px-4 py-3"
                          >
                            {formatAmount(invoice.outstandingAmount)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap">
                          <Link
                            href={invoice.invoiceHref}
                            className="block px-4 py-3"
                          >
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(
                                invoice.displayStatus,
                              )}`}
                            >
                              {invoice.displayStatus.replace("_", " ")}
                            </span>
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-xs text-zinc-600">
                          <Link
                            href={invoice.invoiceHref}
                            className="block px-4 py-3"
                          >
                            {formatDate(new Date(invoice.createdAt))}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </PageContainer>
    );
  }

  const customers = await apiGet<CustomerInvoiceSummaryRow[]>("/invoices");
  const customerRows = customers.map((row) => {
    return {
      ...row.customer,
      invoiceHref: buildInvoicesHref({
        customerId: row.customer.id,
        status: selectedStatus || undefined,
      }),
      totalInvoicedAmount: row.totalInvoiced,
      totalInvoiceCount: row.invoiceCount,
      totalOutstandingAmount: row.totalOutstanding,
      totalPaidAmount: row.totalPaid,
    };
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Distribio invoices"
        title="Invoices"
        subtitle="Select a customer to review invoice totals, paid amounts, and outstanding balances."
        actions={
          canCreateInvoices ? (
            <Link
              href="/invoices/new"
              className={brandPrimaryButtonClassName}
            >
              New Invoice
            </Link>
          ) : null
        }
      />

        <InvoiceStatusFilters selectedStatus={selectedStatus} />

        {customerRows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Add a customer before creating and reviewing invoices."
            actionHref={canCreateCustomers ? "/customers/new" : undefined}
            actionLabel={canCreateCustomers ? "Add Customer" : undefined}
          />
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Customer Name
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Customer Code
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Total Invoice Count
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Total Invoiced Amount
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Total Paid Amount
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Total Outstanding Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {customerRows.map((customer) => (
                    <tr key={customer.id} className="hover:bg-zinc-50">
                      <td className="whitespace-nowrap font-medium">
                        <Link
                          href={customer.invoiceHref}
                          className="block px-4 py-3 font-semibold text-zinc-950"
                        >
                          {customer.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-zinc-600">
                        <Link
                          href={customer.invoiceHref}
                          className="block px-4 py-3"
                        >
                          {customer.code}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                        <Link
                          href={customer.invoiceHref}
                          className="block px-4 py-3"
                        >
                          {customer.totalInvoiceCount}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                        <Link
                          href={customer.invoiceHref}
                          className="block px-4 py-3"
                        >
                          {formatAmount(customer.totalInvoicedAmount)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                        <Link
                          href={customer.invoiceHref}
                          className="block px-4 py-3"
                        >
                          {formatAmount(customer.totalPaidAmount)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                        <Link
                          href={customer.invoiceHref}
                          className="block px-4 py-3"
                        >
                          {formatAmount(customer.totalOutstandingAmount)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </PageContainer>
  );
}
