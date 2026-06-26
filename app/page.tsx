import Link from "next/link";
import { Prisma } from "@prisma/client";
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

export default async function Home() {
  const [customerCount, invoices, latestPayments, activeCheques, reversedCheques] =
    await Promise.all([
      prisma.customer.count(),
      prisma.invoice.findMany({
        select: {
          amount: true,
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
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
      }),
      prisma.payment.findMany({
        include: {
          customer: {
            select: {
              code: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      }),
      prisma.paymentPart.count({
        where: {
          method: "CHEQUE",
          status: "ACTIVE",
        },
      }),
      prisma.paymentPart.count({
        where: {
          method: "CHEQUE",
          status: "REVERSED",
        },
      }),
    ]);

  const totalInvoiced = sumDecimals(invoices.map((invoice) => invoice.amount));
  const totalPaid = sumDecimals(
    invoices.map((invoice) => getActivePaidAmount(invoice.payments)),
  );
  const totalOutstanding = totalInvoiced.minus(totalPaid);
  const outstandingByCustomer = new Map<
    string,
    {
      code: string;
      id: string;
      name: string;
      outstanding: Prisma.Decimal;
    }
  >();

  for (const invoice of invoices) {
    const paidAmount = getActivePaidAmount(invoice.payments);
    const outstandingAmount = invoice.amount.minus(paidAmount);

    if (outstandingAmount.lte(0)) {
      continue;
    }

    const existing = outstandingByCustomer.get(invoice.customer.id);

    outstandingByCustomer.set(invoice.customer.id, {
      code: invoice.customer.code,
      id: invoice.customer.id,
      name: invoice.customer.name,
      outstanding: (existing?.outstanding ?? new Prisma.Decimal(0)).plus(
        outstandingAmount,
      ),
    });
  }

  const highOutstandingCustomers = Array.from(outstandingByCustomer.values())
    .sort((left, right) => right.outstanding.comparedTo(left.outstanding))
    .slice(0, 5);

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
            value={customerCount}
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

            {latestPayments.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center text-sm text-zinc-600">
                No payments recorded yet.
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
                    {latestPayments.map((payment) => (
                      <tr key={payment.id} className="transition-colors hover:bg-zinc-50/80">
                        <td className="whitespace-nowrap px-4 py-4 font-medium text-zinc-950">
                          {payment.customer.name} ({payment.customer.code})
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
              <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center text-sm text-zinc-600">
                No outstanding customer balances.
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
