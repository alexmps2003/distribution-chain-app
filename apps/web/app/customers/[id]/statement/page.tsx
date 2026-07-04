import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptText } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { apiGet } from "@/lib/api-client-server";
import { getAuthenticatedUserServer } from "@/lib/auth-user-server";
import { canCreateInvoice } from "@/lib/permissions";
import PrintStatementButton from "./PrintStatementButton";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type StatementResponse = {
  customer: {
    id: string;
    name: string;
    code: string;
    area: string | null;
    routeName: string | null;
    contactPerson: string | null;
    ownerName: string | null;
    phone: string | null;
    address: string | null;
    assignedCollector: string | null;
  };
  summary: {
    totalInvoiced: string | number;
    totalPaid: string | number;
    totalOutstanding: string | number;
    unpaidInvoiceCount: number;
  };
  ledger: {
    date: string;
    type: "Invoice" | "Payment" | "Reversed Cheque";
    reference: string;
    description: string;
    debit: string | number | null;
    credit: string | number | null;
    runningBalance: string | number;
  }[];
};

type LedgerRow = {
  balance: string | number;
  credit: string | number | null;
  date: Date;
  debit: string | number | null;
  description: string;
  id: string;
  referenceHref?: string;
  referenceLabel: string;
  type: "Invoice" | "Payment" | "Reversed Cheque";
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

function getTypeBadgeClass(type: string) {
  if (type === "Invoice") {
    return "bg-zinc-100 text-zinc-700 ring-zinc-500/20";
  }

  if (type === "Payment") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  }

  return "bg-red-50 text-red-700 ring-red-600/20";
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

export default async function CustomerStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let statement: StatementResponse;
  const authenticatedUser = await getAuthenticatedUserServer();
  const canCreateInvoices = canCreateInvoice(authenticatedUser.role);

  try {
    statement = await apiGet<StatementResponse>(
      `/customers/${encodeURIComponent(id)}/statement`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("failed with 404")) {
      notFound();
    }

    throw error;
  }

  const { customer, ledger, summary } = statement;
  const ledgerRows: LedgerRow[] = ledger.map((row, index) => ({
    balance: row.runningBalance,
    credit: row.credit,
    date: new Date(row.date),
    debit: row.debit,
    description: row.description,
    id: `${row.type}-${row.reference}-${row.date}-${index}`,
    referenceLabel: row.reference,
    type: row.type,
  }));

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
            value={formatAmount(summary.totalInvoiced)}
          />
          <SummaryCard
            label="Total Paid"
            value={formatAmount(summary.totalPaid)}
          />
          <SummaryCard
            label="Total Outstanding"
            value={formatAmount(summary.totalOutstanding)}
          />
          <SummaryCard
            label="Unpaid / Partial Invoices"
            value={summary.unpaidInvoiceCount}
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
              Balance: {formatAmount(summary.totalOutstanding)}
            </p>
          </div>

          {ledgerRows.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={ReceiptText}
                title="No transactions"
                description="This customer has no invoices or payments yet."
                actionHref={canCreateInvoices ? "/invoices/new" : undefined}
                actionLabel={canCreateInvoices ? "Create Invoice" : undefined}
              />
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
