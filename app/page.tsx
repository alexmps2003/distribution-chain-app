import Link from "next/link";
import { CircleCheck, CreditCard } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { apiGet } from "@/lib/api-client";
import { prisma } from "@/lib/prisma";
import DashboardCharts from "./DashboardCharts";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(value: { toString(): string }) {
  return numberFormatter.format(Number(value.toString()));
}

type MoneyValue = string | number;

type DashboardResponse = {
  summary: {
    activeCheques: number;
    reversedCheques: number;
    totalCustomers: number;
    totalInvoiced: MoneyValue;
    totalOutstanding: MoneyValue;
    totalPaid: MoneyValue;
  };
  recentPayments: {
    amount: MoneyValue;
    customer: {
      code: string;
      name: string;
    } | null;
    id: string;
    paymentDate: string;
  }[];
  highOutstandingCustomers: {
    area: string | null;
    code: string;
    id: string;
    invoiceCount: number;
    isActive: boolean;
    name: string;
    outstanding: MoneyValue;
    overdueOutstanding: MoneyValue;
    routeName: string | null;
  }[];
  invoiceStatus: {
    PAID: number;
    PARTIALLY_PAID: number;
    UNPAID: number;
  };
  monthlyCollections: {
    amount: MoneyValue;
    month: string;
    monthKey: string;
    receiptCount: number;
  }[];
};

function formatDate(date: Date | null) {
  if (!date) return "-";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getOutstandingLimit(value: string | string[] | undefined) {
  const selectedValue = getSearchParamValue(value);

  if (selectedValue === "all") {
    return "all";
  }

  const limit = Number(selectedValue);

  return limit === 20 || limit === 50 ? limit : 10;
}

function getOutstandingMin(value: string | string[] | undefined) {
  const selectedValue = getSearchParamValue(value);
  const minimum = Number(selectedValue);

  return minimum === 10000 ||
    minimum === 25000 ||
    minimum === 50000 ||
    minimum === 100000
    ? minimum
    : 0;
}

function getOutstandingTextFilter(value: string | string[] | undefined) {
  const selectedValue = getSearchParamValue(value);

  return selectedValue && selectedValue.trim() !== "" ? selectedValue : "all";
}

function getOutstandingStatus(value: string | string[] | undefined) {
  const selectedValue = getSearchParamValue(value);

  if (selectedValue === "ACTIVE" || selectedValue === "INACTIVE") {
    return selectedValue;
  }

  return "all";
}

type InvoiceStatusRange =
  | "allTime"
  | "last3Months"
  | "last6Months"
  | "lastMonth"
  | "thisMonth"
  | "thisYear";

type CollectionsRange =
  | "allTime"
  | "last3Months"
  | "last6Months"
  | "lastYear"
  | "thisYear";

function getInvoiceStatusRange(
  value: string | string[] | undefined,
): InvoiceStatusRange {
  const selectedValue = getSearchParamValue(value);

  if (
    selectedValue === "thisMonth" ||
    selectedValue === "lastMonth" ||
    selectedValue === "last3Months" ||
    selectedValue === "last6Months" ||
    selectedValue === "thisYear"
  ) {
    return selectedValue;
  }

  return "allTime";
}

function getCollectionsRange(
  value: string | string[] | undefined,
): CollectionsRange {
  const selectedValue = getSearchParamValue(value);

  if (
    selectedValue === "last3Months" ||
    selectedValue === "last6Months" ||
    selectedValue === "lastYear" ||
    selectedValue === "allTime"
  ) {
    return selectedValue;
  }

  return "thisYear";
}

function KpiCard({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string | number;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white hover:shadow-md hover:shadow-zinc-950/[0.06]"
    >
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-medium tracking-tight text-zinc-950">
        {value}
      </p>
    </Link>
  );
}

const moduleCards = [
  {
    cta: "Open Customers",
    description: "Manage customer profiles, routes, collectors, and status.",
    href: "/customers",
    title: "Customers",
  },
  {
    cta: "Open Invoices",
    description: "Review customer invoices and current payment progress.",
    href: "/invoices",
    title: "Invoices",
  },
  {
    cta: "Open Payments",
    description: "View recorded receipts and payment allocation history.",
    href: "/payments",
    title: "Payments",
  },
  {
    cta: "Open Cheques",
    description: "Track cheque payments, statuses, and reversal details.",
    href: "/cheques",
    title: "Cheques",
  },
  {
    cta: "View Outstanding",
    description: "See customers and invoices with balances still due.",
    href: "/outstanding",
    title: "Outstanding",
  },
  {
    cta: "Open Aging",
    description: "Review unpaid balances by due date aging buckets.",
    href: "/aging",
    title: "Aging Report",
  },
  {
    cta: "Record Payment",
    description: "Allocate a new customer payment across open invoices.",
    href: "/payments/new",
    title: "Record Payment",
  },
  {
    cta: "Create Invoice",
    description: "Create a new invoice for an active customer.",
    href: "/invoices/new",
    title: "New Invoice",
  },
  {
    cta: "Create Customer",
    description: "Add a new shop or customer to the distribution system.",
    href: "/customers/new",
    title: "New Customer",
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    collectionsRange?: string | string[];
    invoiceStatusRange?: string | string[];
    outstandingArea?: string | string[];
    outstandingLimit?: string | string[];
    outstandingMin?: string | string[];
    outstandingRoute?: string | string[];
    outstandingStatus?: string | string[];
  }>;
}) {
  const {
    collectionsRange: collectionsRangeParam,
    invoiceStatusRange: invoiceStatusRangeParam,
    outstandingArea: outstandingAreaParam,
    outstandingLimit: outstandingLimitParam,
    outstandingMin: outstandingMinParam,
    outstandingRoute: outstandingRouteParam,
    outstandingStatus: outstandingStatusParam,
  } = await searchParams;
  const outstandingLimit = getOutstandingLimit(outstandingLimitParam);
  const outstandingMin = getOutstandingMin(outstandingMinParam);
  const outstandingArea = getOutstandingTextFilter(outstandingAreaParam);
  const outstandingRoute = getOutstandingTextFilter(outstandingRouteParam);
  const outstandingStatus = getOutstandingStatus(outstandingStatusParam);
  const invoiceStatusRange = getInvoiceStatusRange(invoiceStatusRangeParam);
  const collectionsRange = getCollectionsRange(collectionsRangeParam);
  const [dashboard, customerFilterOptions] = await Promise.all([
      apiGet<DashboardResponse>("/dashboard"),
      prisma.customer.findMany({
        select: {
          area: true,
          routeName: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);
  const {
    activeCheques,
    reversedCheques,
    totalCustomers,
    totalInvoiced,
    totalOutstanding,
    totalPaid,
  } = dashboard.summary;
  const recentPayments = dashboard.recentPayments.map((payment) => ({
    ...payment,
    paymentDate: new Date(payment.paymentDate),
  }));
  const highOutstandingCustomers = dashboard.highOutstandingCustomers;
  const invoiceStatusCounts = {
    paid: dashboard.invoiceStatus.PAID,
    partiallyPaid: dashboard.invoiceStatus.PARTIALLY_PAID,
    unpaid: dashboard.invoiceStatus.UNPAID,
  };
  const monthlyCollections = dashboard.monthlyCollections.map((month) => ({
    ...month,
    amount: Number(month.amount),
  }));

  const routeOptions = Array.from(
    new Set(
      customerFilterOptions
        .map((customer) => customer.routeName?.trim())
        .filter((route): route is string => Boolean(route)),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const areaOptions = Array.from(
    new Set(
      customerFilterOptions
        .map((customer) => customer.area?.trim())
        .filter((area): area is string => Boolean(area)),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const selectedOutstandingRoute = routeOptions.includes(outstandingRoute)
    ? outstandingRoute
    : "all";
  const selectedOutstandingArea = areaOptions.includes(outstandingArea)
    ? outstandingArea
    : "all";

  const filteredOutstandingCustomers = highOutstandingCustomers
    .filter((customer) => Number(customer.outstanding) >= outstandingMin)
    .filter((customer) => {
      return (
        selectedOutstandingArea === "all" ||
        customer.area === selectedOutstandingArea
      );
    })
    .filter((customer) => {
      return (
        selectedOutstandingRoute === "all" ||
        customer.routeName === selectedOutstandingRoute
      );
    })
    .filter((customer) => {
      if (outstandingStatus === "ACTIVE") {
        return customer.isActive;
      }

      if (outstandingStatus === "INACTIVE") {
        return !customer.isActive;
      }

      return true;
    })
    .sort(
      (left, right) =>
        Number(right.outstanding) - Number(left.outstanding),
    );
  const topOutstandingCustomers = (
    outstandingLimit === "all"
      ? filteredOutstandingCustomers
      : filteredOutstandingCustomers.slice(0, outstandingLimit)
  )
    .map((customer) => ({
      customer: customer.name,
      customerId: customer.id,
      invoiceCount: customer.invoiceCount,
      outstanding: Number(customer.outstanding),
      overdueOutstanding: Number(customer.overdueOutstanding),
    }));

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-9">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">
            Distribution Chain Dashboard
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Monitor customers, invoices, payments, cheques, and outstanding
            balances.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            href="/customers"
            label="Total Customers"
            value={totalCustomers}
          />
          <KpiCard
            href="/outstanding"
            label="Total Outstanding"
            value={formatAmount(totalOutstanding)}
          />
          <KpiCard
            href="/cheques?status=ACTIVE"
            label="Active Cheques"
            value={activeCheques}
          />
          <KpiCard
            href="/cheques?status=REVERSED"
            label="Reversed Cheques"
            value={reversedCheques}
          />
          <KpiCard
            href="/invoices"
            label="Total Invoiced"
            value={formatAmount(totalInvoiced)}
          />
          <KpiCard
            href="/payments"
            label="Total Paid"
            value={formatAmount(totalPaid)}
          />
        </section>

        <DashboardCharts
          customerOutstanding={topOutstandingCustomers}
          customerOutstandingAreaOptions={areaOptions}
          customerOutstandingRouteOptions={routeOptions}
          invoiceStatus={invoiceStatusCounts}
          selectedCollectionsRange={collectionsRange}
          selectedInvoiceStatusRange={invoiceStatusRange}
          selectedOutstandingArea={selectedOutstandingArea}
          selectedOutstandingLimit={outstandingLimit}
          selectedOutstandingMin={outstandingMin}
          selectedOutstandingRoute={selectedOutstandingRoute}
          selectedOutstandingStatus={outstandingStatus}
          monthlyCollections={monthlyCollections}
        />

        <section>
          <h2 className="text-lg font-medium tracking-tight">
            Quick Actions
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {moduleCards.map((card) => (
              <div
                key={card.href}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03]"
              >
                <div>
                  <h3 className="text-base font-medium text-zinc-950">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {card.description}
                  </p>
                </div>
                <Link
                  href={card.href}
                  className="mt-5 inline-flex h-10 w-fit items-center justify-center rounded-full bg-zinc-950 px-4 text-xs font-medium text-white shadow-sm shadow-zinc-950/10 transition-colors hover:bg-zinc-800"
                >
                  {card.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-sm shadow-zinc-950/[0.03]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium tracking-tight">
                Recent Activity
              </h2>
              <Link
                href="/payments"
                className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950"
              >
                View all
              </Link>
            </div>

            {recentPayments.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={CreditCard}
                  title="No payments recorded"
                  description="Record a payment to start seeing recent activity here."
                  actionHref="/payments/new"
                  actionLabel="Record Payment"
                />
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200/80">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                    <tr>
                      <th scope="col" className="px-4 py-3.5">
                        Customer
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Date
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Receipt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {recentPayments.map((payment) => (
                      <tr key={payment.id} className="transition-colors hover:bg-zinc-50/80">
                        <td className="whitespace-nowrap px-4 py-4 font-medium text-zinc-950">
                          {payment.customer
                            ? `${payment.customer.name} (${payment.customer.code})`
                            : "Customer not found"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-zinc-600">
                          {formatDate(payment.paymentDate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-medium text-zinc-600">
                          {formatAmount(payment.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <Link
                            href={`/payments/${payment.id}`}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-300 bg-white px-3.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
                          >
                            Receipt
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-sm shadow-zinc-950/[0.03]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium tracking-tight">
                High Outstanding Customers
              </h2>
              <Link
                href="/outstanding"
                className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950"
              >
                View report
              </Link>
            </div>

            {highOutstandingCustomers.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={CircleCheck}
                  title="No outstanding balances"
                  description="All invoices are fully paid."
                />
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200/80">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                    <tr>
                      <th scope="col" className="px-4 py-3.5">
                        Customer
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Code
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Outstanding
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {highOutstandingCustomers.map((customer) => {
                      const href = `/outstanding?customerId=${customer.id}`;

                      return (
                        <tr key={customer.id} className="transition-colors hover:bg-zinc-50/80">
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
                          <td className="whitespace-nowrap text-right font-medium text-zinc-600">
                            <Link href={href} className="block px-4 py-4">
                              {formatAmount(customer.outstanding)}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
