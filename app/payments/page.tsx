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

const methodOptions = [
  { label: "All", value: "" },
  { label: "Cash", value: "CASH" },
  { label: "Cheque", value: "CHEQUE" },
  { label: "Bank Transfer", value: "BANK_TRANSFER" },
  { label: "Card", value: "CARD" },
  { label: "Mixed", value: "MIXED" },
] as const;

function getSelectedMethod(method: string | undefined) {
  if (
    method === "CASH" ||
    method === "CHEQUE" ||
    method === "BANK_TRANSFER" ||
    method === "CARD" ||
    method === "MIXED"
  ) {
    return method;
  }

  return "";
}

function getDateFromParam(value: string | undefined, endOfDay = false) {
  if (!value) return undefined;

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function getMonthRangeFromParam(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return undefined;
  }

  const [yearValue, monthValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (month < 1 || month > 12) {
    return undefined;
  }

  return {
    end: new Date(year, month, 1),
    start: new Date(year, month - 1, 1),
  };
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    method?: string;
    month?: string;
    search?: string;
    to?: string;
  }>;
}) {
  const { from, method, month, search, to } = await searchParams;
  const selectedMethod = getSelectedMethod(method);
  const searchQuery = search?.trim() ?? "";
  const fromDate = getDateFromParam(from);
  const toDate = getDateFromParam(to, true);
  const monthRange = getMonthRangeFromParam(month);
  const paymentDateFilter = monthRange
    ? {
        gte: monthRange.start,
        lt: monthRange.end,
      }
    : fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;
  const where: Prisma.PaymentWhereInput = {
    ...(selectedMethod ? { paymentMethod: selectedMethod } : {}),
    ...(searchQuery
      ? {
          customer: {
            OR: [
              {
                name: {
                  contains: searchQuery,
                  mode: "insensitive",
                },
              },
              {
                code: {
                  contains: searchQuery,
                  mode: "insensitive",
                },
              },
            ],
          },
        }
      : {}),
    ...(paymentDateFilter
      ? {
          paymentDate: paymentDateFilter,
        }
      : {}),
  };
  const payments = await prisma.payment.findMany({
    where,
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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Payments</h1>
          <Link
            href="/payments/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            New Payment
          </Link>
        </div>

        <form
          action="/payments"
          className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_170px_170px_auto_auto] lg:items-end">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Search customer
              <input
                type="search"
                name="search"
                defaultValue={searchQuery}
                placeholder="Name or code"
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Payment Method
              <select
                name="method"
                defaultValue={selectedMethod}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              >
                {methodOptions.map((option) => (
                  <option key={option.value || "ALL"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              From Date
              <input
                type="date"
                name="from"
                defaultValue={from ?? ""}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              To Date
              <input
                type="date"
                name="to"
                defaultValue={to ?? ""}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Filter
            </button>
            <Link
              href="/payments"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
            >
              Clear Filters
            </Link>
          </div>
        </form>

        {payments.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
            No payments found.
          </div>
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
                      Payment Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Amount
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Created Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {payment.customer.name} ({payment.customer.code})
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {formatDate(payment.paymentDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-600 font-medium">
                        {formatAmount(payment.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/payments/${payment.id}`}
                          className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
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
