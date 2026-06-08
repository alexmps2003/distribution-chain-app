import Link from "next/link";
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

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: {
      customer: {
        select: {
          name: true,
          code: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
          <Link
            href="/invoices/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            New Invoice
          </Link>
        </div>

        {invoices.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
            No invoices found.
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
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Invoice Date
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Due Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Amount
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
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {invoice.customer.name} ({invoice.customer.code})
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {formatDate(invoice.invoiceDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-600 font-medium">
                        {formatAmount(invoice.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider ${
                            invoice.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : invoice.status === "UNPAID"
                                ? "bg-rose-100 text-rose-800"
                                : invoice.status === "PARTIALLY_PAID"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-zinc-200 text-zinc-800"
                          }`}
                        >
                          {invoice.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600 text-xs">
                        {formatDate(invoice.createdAt)}
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
