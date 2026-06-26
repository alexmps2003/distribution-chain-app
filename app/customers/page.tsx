import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Users } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { prisma } from "@/lib/prisma";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(value: { toString(): string }) {
  return numberFormatter.format(Number(value.toString()));
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

function getUniqueOptions(values: (string | null)[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    area?: string;
    outstanding?: string;
    route?: string;
    search?: string;
  }>;
}) {
  const { area, outstanding, route, search } = await searchParams;
  const searchQuery = search?.trim().toLowerCase() ?? "";
  const selectedArea = area?.trim() ?? "";
  const selectedRoute = route?.trim() ?? "";
  const outstandingOnly = outstanding === "true";
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      area: true,
      routeName: true,
      assignedCollector: true,
      isActive: true,
      invoices: {
        select: {
          amount: true,
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
      createdAt: "desc",
    },
  });
  const areaOptions = getUniqueOptions(customers.map((customer) => customer.area));
  const routeOptions = getUniqueOptions(
    customers.map((customer) => customer.routeName),
  );
  const customerRows = customers.map((customer) => {
    const totalInvoiced = sumDecimals(
      customer.invoices.map((invoice) => invoice.amount),
    );
    const totalPaid = sumDecimals(
      customer.invoices.map((invoice) => getActivePaidAmount(invoice.payments)),
    );
    const invoiceOutstanding = totalInvoiced.minus(totalPaid);
    const openInvoiceCount = customer.invoices.filter((invoice) => {
      const paidAmount = getActivePaidAmount(invoice.payments);

      return paidAmount.lt(invoice.amount);
    }).length;

    return {
      ...customer,
      invoiceOutstanding,
      openInvoiceCount,
      totalInvoiced,
      totalPaid,
    };
  });
  const filteredCustomerRows = customerRows.filter((customer) => {
    const matchesSearch =
      !searchQuery ||
      customer.name.toLowerCase().includes(searchQuery) ||
      customer.code.toLowerCase().includes(searchQuery);
    const matchesArea = !selectedArea || customer.area === selectedArea;
    const matchesRoute = !selectedRoute || customer.routeName === selectedRoute;
    const matchesOutstanding =
      !outstandingOnly || customer.invoiceOutstanding.gt(0);

    return matchesSearch && matchesArea && matchesRoute && matchesOutstanding;
  });
  const totalInvoiced = sumDecimals(
    filteredCustomerRows.map((customer) => customer.totalInvoiced),
  );
  const totalPaid = sumDecimals(
    filteredCustomerRows.map((customer) => customer.totalPaid),
  );
  const totalOutstanding = totalInvoiced.minus(totalPaid);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Customers</h1>
          <Link
            href="/customers/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            New Customer
          </Link>
        </div>

        <form
          action="/customers"
          className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_auto_auto] lg:items-end">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Search customer
              <input
                type="search"
                name="search"
                defaultValue={search ?? ""}
                placeholder="Name or code"
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Area
              <select
                name="area"
                defaultValue={selectedArea}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="">All areas</option>
                {areaOptions.map((areaOption) => (
                  <option key={areaOption} value={areaOption}>
                    {areaOption}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Route
              <select
                name="route"
                defaultValue={selectedRoute}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="">All routes</option>
                {routeOptions.map((routeOption) => (
                  <option key={routeOption} value={routeOption}>
                    {routeOption}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800">
              <input
                type="checkbox"
                name="outstanding"
                value="true"
                defaultChecked={outstandingOnly}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
              />
              Outstanding Only
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Filter
              </button>
              <Link
                href="/customers"
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
              >
                Clear Filters
              </Link>
            </div>
          </div>
        </form>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total Customers"
            value={filteredCustomerRows.length}
          />
          <SummaryCard label="Total Invoiced" value={formatAmount(totalInvoiced)} />
          <SummaryCard label="Total Paid" value={formatAmount(totalPaid)} />
          <SummaryCard
            label="Total Outstanding"
            value={formatAmount(totalOutstanding)}
          />
        </section>

        {filteredCustomerRows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Create your first customer to begin recording invoices and payments."
            actionHref="/customers/new"
            actionLabel="Add Customer"
          />
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Code
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Shop Name
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Area
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Route
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Assigned Collector
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Total Invoiced
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Total Paid
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Total Outstanding
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Unpaid/Partial Invoices
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredCustomerRows.map((customer) => (
                    <tr key={customer.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {customer.code}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {customer.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {customer.area ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {customer.routeName ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {customer.assignedCollector ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                        {formatAmount(customer.totalInvoiced)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                        {formatAmount(customer.totalPaid)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                        {formatAmount(customer.invoiceOutstanding)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-600">
                        {customer.openInvoiceCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={
                            customer.isActive
                              ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                              : "inline-flex rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700"
                          }
                        >
                          {customer.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            View
                          </Link>
                          <Link
                            href={`/customers/${customer.id}/edit`}
                            className="inline-flex h-8 items-center justify-center rounded-md bg-zinc-950 px-3 text-xs font-medium text-white hover:bg-zinc-800"
                          >
                            Edit
                          </Link>
                        </div>
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
