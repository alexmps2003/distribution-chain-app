import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BANK_OPTIONS } from "@/lib/bank-options";

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

function normalizePaymentPartStatus(status: string | null | undefined) {
  // Temporary safeguard: PaymentPart.status was added after PaymentPart records
  // already existed. The migration defines NOT NULL DEFAULT 'ACTIVE', so an
  // applied database should backfill old rows, but stale dev databases or
  // generated payloads can still surface null/undefined until migrations and
  // Prisma Client are fully in sync.
  return status ?? "ACTIVE";
}

function formatStatus(status: string | null | undefined) {
  return normalizePaymentPartStatus(status).replace("_", " ");
}

function getStatusBadgeClass(status: string | null | undefined) {
  const normalizedStatus = normalizePaymentPartStatus(status);

  if (normalizedStatus === "ACTIVE") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalizedStatus === "REVERSED") {
    return "bg-red-100 text-red-700";
  }

  return "bg-zinc-200 text-zinc-700";
}

export default async function ChequesPage({
  searchParams,
}: {
  searchParams: Promise<{
    bank?: string;
    q?: string;
    search?: string;
    status?: string;
  }>;
}) {
  const { bank, q, search, status } = await searchParams;
  const query = (search ?? q)?.trim() ?? "";
  const selectedBank = BANK_OPTIONS.includes(
    bank as (typeof BANK_OPTIONS)[number],
  )
    ? bank
    : "";
  const selectedStatus =
    status === "ACTIVE" || status === "REVERSED" ? status : "";

  const cheques = await prisma.paymentPart.findMany({
    where: {
      method: "CHEQUE",
      ...(selectedStatus ? { status: selectedStatus } : {}),
      ...(selectedBank ? { chequeBank: selectedBank } : {}),
      ...(query
        ? {
            chequeNumber: {
              contains: query,
              mode: "insensitive",
            },
          }
        : {}),
    },
    include: {
      payment: {
        select: {
          id: true,
          paymentDate: true,
          customer: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      chequeDate: "desc",
    },
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Cheques</h1>
          <Link
            href="/payments"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
          >
            Back to Payments
          </Link>
        </div>

        <form
          action="/cheques"
          className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_auto_auto] lg:items-end">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Search cheque number
              <input
                type="search"
                name="search"
                defaultValue={query}
                placeholder="Enter cheque number"
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Bank
              <select
                name="bank"
                defaultValue={selectedBank}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="">All banks</option>
                {BANK_OPTIONS.map((bankOption) => (
                  <option key={bankOption} value={bankOption}>
                    {bankOption}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Status
              <select
                name="status"
                defaultValue={selectedStatus}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="">All</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="REVERSED">REVERSED</option>
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Search
            </button>
            <Link
              href="/cheques"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
            >
              Clear Filters
            </Link>
          </div>
        </form>

        {cheques.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
            No cheques found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Cheque Number
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Bank
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Cheque Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Amount
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Payment Date
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Payment Receipt
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {cheques.map((cheque) => (
                    <tr key={cheque.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950">
                        {cheque.chequeNumber ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {cheque.chequeBank ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {formatDate(cheque.chequeDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                        {formatAmount(cheque.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {cheque.payment.customer.name} (
                        {cheque.payment.customer.code})
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {formatDate(cheque.payment.paymentDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                            cheque.status,
                          )}`}
                        >
                          {formatStatus(cheque.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/payments/${cheque.payment.id}?returnTo=/cheques`}
                          className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          Receipt
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/cheques/${cheque.id}`}
                          className="inline-flex h-8 items-center justify-center rounded-md bg-zinc-950 px-3 text-xs font-medium text-white hover:bg-zinc-800"
                        >
                          View
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
