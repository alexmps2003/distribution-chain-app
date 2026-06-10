import Link from "next/link";
import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

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

function getDisplayStatus(
  invoiceTotal: Prisma.Decimal,
  paidAmount: Prisma.Decimal,
) {
  if (paidAmount.gte(invoiceTotal)) {
    return "PAID";
  }

  if (paidAmount.gt(0)) {
    return "PARTIALLY_PAID";
  }

  return "UNPAID";
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

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;

  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      select: {
        code: true,
        name: true,
        invoices: {
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
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!customer) {
      notFound();
    }

    const invoiceRows = customer.invoices.map((invoice) => {
      const paidAmount = getActivePaidAmount(invoice.payments);
      const outstandingAmount = invoice.amount.minus(paidAmount);
      const displayStatus = getDisplayStatus(invoice.amount, paidAmount);

      return {
        ...invoice,
        displayStatus,
        outstandingAmount,
        paidAmount,
      };
    });

    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {customer.name} Invoices
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Customer code: {customer.code}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/invoices"
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
              >
                Back to Customers
              </Link>
              <Link
                href="/invoices/new"
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
              >
                New Invoice
              </Link>
            </div>
          </div>

          {invoiceRows.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
              No invoices found for this customer.
            </div>
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
                            href={`/invoices/${invoice.id}`}
                            className="block px-4 py-3 font-semibold text-zinc-950"
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-zinc-600">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="block px-4 py-3"
                          >
                            {formatDate(invoice.invoiceDate)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-zinc-600">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="block px-4 py-3"
                          >
                            {formatDate(invoice.dueDate)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="block px-4 py-3"
                          >
                            {formatAmount(invoice.amount)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="block px-4 py-3"
                          >
                            {formatAmount(invoice.paidAmount)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="block px-4 py-3"
                          >
                            {formatAmount(invoice.outstandingAmount)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap">
                          <Link
                            href={`/invoices/${invoice.id}`}
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
                            href={`/invoices/${invoice.id}`}
                            className="block px-4 py-3"
                          >
                            {formatDate(invoice.createdAt)}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      invoices: {
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
      },
    },
    orderBy: {
      name: "asc",
    },
  });
  const customerRows = customers.map((customer) => {
    const totalInvoicedAmount = sumDecimals(
      customer.invoices.map((invoice) => invoice.amount),
    );
    const totalPaidAmount = sumDecimals(
      customer.invoices.map((invoice) => getActivePaidAmount(invoice.payments)),
    );
    const totalOutstandingAmount = totalInvoicedAmount.minus(totalPaidAmount);

    return {
      ...customer,
      totalInvoicedAmount,
      totalInvoiceCount: customer.invoices.length,
      totalOutstandingAmount,
      totalPaidAmount,
    };
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Select a customer to view their invoices.
            </p>
          </div>
          <Link
            href="/invoices/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            New Invoice
          </Link>
        </div>

        {customerRows.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
            No customers found.
          </div>
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
                          href={`/invoices?customerId=${customer.id}`}
                          className="block px-4 py-3 font-semibold text-zinc-950"
                        >
                          {customer.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-zinc-600">
                        <Link
                          href={`/invoices?customerId=${customer.id}`}
                          className="block px-4 py-3"
                        >
                          {customer.code}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                        <Link
                          href={`/invoices?customerId=${customer.id}`}
                          className="block px-4 py-3"
                        >
                          {customer.totalInvoiceCount}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                        <Link
                          href={`/invoices?customerId=${customer.id}`}
                          className="block px-4 py-3"
                        >
                          {formatAmount(customer.totalInvoicedAmount)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                        <Link
                          href={`/invoices?customerId=${customer.id}`}
                          className="block px-4 py-3"
                        >
                          {formatAmount(customer.totalPaidAmount)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                        <Link
                          href={`/invoices?customerId=${customer.id}`}
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
      </div>
    </main>
  );
}
