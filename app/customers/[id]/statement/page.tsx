import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import PrintStatementButton from "./PrintStatementButton";

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

function formatMethod(method: string) {
  return method
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sumDecimals(values: Prisma.Decimal[]) {
  return values.reduce(
    (total, value) => total.plus(value),
    new Prisma.Decimal(0),
  );
}

function formatPaymentReference(payment: { id: string; paymentDate: Date }) {
  const datePart = payment.paymentDate
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
  const idPart = payment.id.slice(-4).toUpperCase();

  return `PAY-${datePart}-${idPart}`;
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

function getInvoiceStatus(invoiceTotal: Prisma.Decimal, paidAmount: Prisma.Decimal) {
  if (paidAmount.gte(invoiceTotal)) {
    return "PAID";
  }

  if (paidAmount.gt(0)) {
    return "PARTIALLY_PAID";
  }

  return "UNPAID";
}

function getTypeBadgeClass(type: string) {
  if (type === "Invoice") {
    return "bg-zinc-100 text-zinc-700 ring-zinc-500/20";
  }

  if (type === "Payment") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  }

  return "bg-red-50 text-red-700 ring-red-600/20";
}

function getMethodDetails(allocation: {
  payment: {
    paymentMethod: string;
  };
  paymentPart: {
    method: string;
    chequeNumber: string | null;
    chequeBank: string | null;
    chequeDate: Date | null;
    bankReference: string | null;
    cardReference: string | null;
  } | null;
}) {
  const part = allocation.paymentPart;

  if (!part) {
    return formatMethod(allocation.payment.paymentMethod || "Payment");
  }

  if (part.method === "CHEQUE") {
    return [
      "Cheque",
      part.chequeNumber ? `#${part.chequeNumber}` : "",
      part.chequeBank ? part.chequeBank : "",
      part.chequeDate ? formatDate(part.chequeDate) : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (part.method === "BANK_TRANSFER") {
    return part.bankReference
      ? `Bank Transfer · Ref ${part.bankReference}`
      : "Bank Transfer";
  }

  if (part.method === "CARD") {
    return part.cardReference ? `Card · Ref ${part.cardReference}` : "Card";
  }

  return formatMethod(part.method);
}

type LedgerEntry = {
  credit: Prisma.Decimal | null;
  date: Date;
  debit: Prisma.Decimal | null;
  description: string;
  id: string;
  referenceHref?: string;
  referenceLabel: string;
  sortOrder: number;
  type: "Invoice" | "Payment" | "Reversed Cheque";
};

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

export default async function CustomerStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      invoices: {
        include: {
          payments: {
            include: {
              payment: {
                select: {
                  id: true,
                  paymentDate: true,
                  paymentMethod: true,
                  createdAt: true,
                },
              },
              paymentPart: {
                select: {
                  id: true,
                  method: true,
                  amount: true,
                  status: true,
                  chequeNumber: true,
                  chequeBank: true,
                  chequeDate: true,
                  bankReference: true,
                  cardReference: true,
                  reversedAt: true,
                  reversalReason: true,
                  createdAt: true,
                },
              },
            },
          },
        },
        orderBy: {
          invoiceDate: "asc",
        },
      },
      payments: {
        include: {
          parts: true,
          allocations: true,
        },
        orderBy: {
          paymentDate: "asc",
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  const totalInvoiced = sumDecimals(
    customer.invoices.map((invoice) => invoice.amount),
  );
  const totalPaid = sumDecimals(
    customer.invoices.map((invoice) => getActivePaidAmount(invoice.payments)),
  );
  const totalOutstanding = totalInvoiced.minus(totalPaid);
  const unpaidOrPartialInvoiceCount = customer.invoices.filter((invoice) => {
    const paidAmount = getActivePaidAmount(invoice.payments);
    const status = getInvoiceStatus(invoice.amount, paidAmount);

    return status === "UNPAID" || status === "PARTIALLY_PAID";
  }).length;

  const ledgerEntries: LedgerEntry[] = [];

  for (const invoice of customer.invoices) {
    ledgerEntries.push({
      credit: null,
      date: invoice.invoiceDate,
      debit: invoice.amount,
      description: `Invoice issued to ${customer.name}`,
      id: `invoice-${invoice.id}`,
      referenceHref: `/invoices/${invoice.id}?customerId=${customer.id}`,
      referenceLabel: invoice.invoiceNumber,
      sortOrder: 0,
      type: "Invoice",
    });

    for (const allocation of invoice.payments) {
      const paymentReference = formatPaymentReference(allocation.payment);
      const part = allocation.paymentPart;

      if (part === null || part.status === "ACTIVE") {
        ledgerEntries.push({
          credit: allocation.amount,
          date: allocation.payment.paymentDate,
          debit: null,
          description: `${getMethodDetails(
            allocation,
          )} allocated to invoice ${invoice.invoiceNumber}`,
          id: `payment-${allocation.id}`,
          referenceHref: `/payments/${allocation.payment.id}`,
          referenceLabel: paymentReference,
          sortOrder: 1,
          type: "Payment",
        });

        continue;
      }

      if (part.method === "CHEQUE" && part.status === "REVERSED") {
        ledgerEntries.push({
          credit: null,
          date: part.reversedAt ?? allocation.payment.paymentDate,
          debit: null,
          description: `Reversed cheque allocation of ${formatAmount(
            allocation.amount,
          )} for invoice ${invoice.invoiceNumber}. ${
            part.reversalReason
              ? `Reason: ${part.reversalReason}`
              : "This allocation no longer counts toward invoice payments."
          }`,
          id: `reversed-cheque-${allocation.id}`,
          referenceHref: `/cheques/${part.id}`,
          referenceLabel: part.chequeNumber
            ? `Cheque #${part.chequeNumber}`
            : "Cheque",
          sortOrder: 2,
          type: "Reversed Cheque",
        });
      }
    }
  }

  const ledgerRows = ledgerEntries
    .sort((left, right) => {
      const byDate = left.date.getTime() - right.date.getTime();

      if (byDate !== 0) {
        return byDate;
      }

      return left.sortOrder - right.sortOrder;
    })
    .reduce<{
      balance: Prisma.Decimal;
      rows: (LedgerEntry & { balance: Prisma.Decimal })[];
    }>(
      (statement, entry) => {
        const balance = statement.balance
          .plus(entry.debit ?? new Prisma.Decimal(0))
          .minus(entry.credit ?? new Prisma.Decimal(0));

        return {
          balance,
          rows: [...statement.rows, { ...entry, balance }],
        };
      },
      { balance: new Prisma.Decimal(0), rows: [] },
    ).rows;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950 print:bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-sm shadow-zinc-950/[0.03] print:border-zinc-300 print:shadow-none">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                Customer Statement
              </p>
              <h1 className="mt-2 text-3xl font-medium tracking-tight text-zinc-950">
                {customer.name}
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Code: <span className="font-medium">{customer.code}</span>
                {customer.area ? ` · Area: ${customer.area}` : ""}
                {customer.routeName ? ` · Route: ${customer.routeName}` : ""}
              </p>
            </div>
            <div className="flex flex-col gap-3 print:hidden sm:flex-row">
              <Link
                href={`/customers/${customer.id}`}
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
              >
                Back to Customer
              </Link>
              <Link
                href="/customers"
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
              >
                Back to Customers
              </Link>
              <PrintStatementButton />
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total Invoiced"
            value={formatAmount(totalInvoiced)}
          />
          <SummaryCard label="Total Paid" value={formatAmount(totalPaid)} />
          <SummaryCard
            label="Total Outstanding"
            value={formatAmount(totalOutstanding)}
          />
          <SummaryCard
            label="Unpaid / Partial Invoices"
            value={unpaidOrPartialInvoiceCount}
          />
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-sm shadow-zinc-950/[0.03] print:border-zinc-300 print:shadow-none">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-medium tracking-tight">
                Statement Ledger
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Running balance from invoices and active payment allocations.
                Reversed cheques are shown for audit visibility but do not
                reduce the balance.
              </p>
            </div>
            <p className="text-sm font-medium text-zinc-700">
              Balance: {formatAmount(totalOutstanding)}
            </p>
          </div>

          {ledgerRows.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center text-sm text-zinc-600">
              No statement activity found for this customer.
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200/80">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                    <tr>
                      <th scope="col" className="px-4 py-3.5">
                        Date
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Type
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Reference
                      </th>
                      <th scope="col" className="px-4 py-3.5">
                        Description
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Debit
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Credit
                      </th>
                      <th scope="col" className="px-4 py-3.5 text-right">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {ledgerRows.map((row) => (
                      <tr key={row.id} className="hover:bg-zinc-50/80">
                        <td className="whitespace-nowrap px-4 py-4 text-zinc-600">
                          {formatDate(row.date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${getTypeBadgeClass(
                              row.type,
                            )}`}
                          >
                            {row.type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-medium text-zinc-950">
                          {row.referenceHref ? (
                            <Link
                              href={row.referenceHref}
                              className="text-zinc-950 underline-offset-4 hover:underline"
                            >
                              {row.referenceLabel}
                            </Link>
                          ) : (
                            row.referenceLabel
                          )}
                        </td>
                        <td className="min-w-64 px-4 py-4 leading-6 text-zinc-600">
                          {row.description}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-medium text-zinc-700">
                          {row.debit ? formatAmount(row.debit) : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-medium text-zinc-700">
                          {row.credit ? formatAmount(row.credit) : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-medium text-zinc-950">
                          {formatAmount(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-sm shadow-zinc-950/[0.03] print:border-zinc-300 print:shadow-none">
          <h2 className="text-lg font-medium tracking-tight">
            Customer Details
          </h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                Contact
              </dt>
              <dd className="mt-1 text-sm text-zinc-950">
                {customer.contactPerson ?? customer.ownerName ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                Phone
              </dt>
              <dd className="mt-1 text-sm text-zinc-950">
                {customer.phone ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                Address
              </dt>
              <dd className="mt-1 text-sm text-zinc-950">
                {customer.address ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                Assigned Collector
              </dt>
              <dd className="mt-1 text-sm text-zinc-950">
                {customer.assignedCollector ?? "-"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
