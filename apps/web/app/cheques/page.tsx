import Link from "next/link";
import { Landmark } from "lucide-react";
import FilterBar from "@/components/distribio/FilterBar";
import PageContainer from "@/components/distribio/PageContainer";
import PageHeader from "@/components/distribio/PageHeader";
import {
  brandInputClassName,
  brandPrimaryButtonClassName,
  brandSecondaryButtonClassName,
  brandSmallPrimaryButtonClassName,
  brandSmallSecondaryButtonClassName,
} from "@/components/distribio/brand";
import EmptyState from "@/components/EmptyState";
import { apiGet } from "@/lib/api-client-server";
import { getAuthenticatedUserServer } from "@/lib/auth-user-server";
import { BANK_OPTIONS } from "@/lib/bank-options";
import { canCreatePayment } from "@/lib/permissions";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type MoneyValue = string | number;

type ChequeRow = {
  amount: MoneyValue;
  chequeBank: string | null;
  chequeDate: string | null;
  chequeNumber: string | null;
  id: string;
  payment: {
    id: string;
    paymentDate: string;
    customer: {
      code: string;
      name: string;
    } | null;
  } | null;
  status: string | null;
};

function formatAmount(value: MoneyValue) {
  return numberFormatter.format(Number(String(value)));
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

  const apiParams = new URLSearchParams();

  if (query) {
    apiParams.set("q", query);
  }

  if (selectedBank) {
    apiParams.set("bank", selectedBank);
  }

  if (selectedStatus) {
    apiParams.set("status", selectedStatus);
  }

  const [cheques, authenticatedUser] = await Promise.all([
    apiGet<ChequeRow[]>(
      `/cheques${apiParams.size > 0 ? `?${apiParams.toString()}` : ""}`,
    ),
    getAuthenticatedUserServer(),
  ]);
  const canCreatePayments = canCreatePayment(authenticatedUser.role);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Distribio cheques"
        title="Cheques"
        subtitle="Review cheque payments, bank details, statuses, and receipt links."
        actions={
          <Link
            href="/payments"
            className={brandSecondaryButtonClassName}
          >
            Back to Payments
          </Link>
        }
      />

      <form action="/cheques">
        <FilterBar>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_auto_auto] lg:items-end">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Search cheque number
              <input
                type="search"
                name="search"
                defaultValue={query}
                placeholder="Enter cheque number"
                className={brandInputClassName}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Bank
              <select
                name="bank"
                defaultValue={selectedBank}
                className={brandInputClassName}
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
                className={brandInputClassName}
              >
                <option value="">All</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="REVERSED">REVERSED</option>
              </select>
            </label>
            <button
              type="submit"
              className={brandPrimaryButtonClassName}
            >
              Search
            </button>
            <Link
              href="/cheques"
              className={brandSecondaryButtonClassName}
            >
              Clear Filters
            </Link>
          </div>
        </FilterBar>
      </form>

      {cheques.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No cheques available"
          description="Cheque payments will appear here after they are recorded."
          actionHref={canCreatePayments ? "/payments/new" : undefined}
          actionLabel={canCreatePayments ? "Record Payment" : undefined}
        />
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
                      {formatDate(
                        cheque.chequeDate ? new Date(cheque.chequeDate) : null,
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                      {formatAmount(cheque.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                      {cheque.payment?.customer
                        ? `${cheque.payment.customer.name} (${cheque.payment.customer.code})`
                        : "Customer not found"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                      {formatDate(
                        cheque.payment
                          ? new Date(cheque.payment.paymentDate)
                          : null,
                      )}
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
                        href={
                          cheque.payment
                            ? `/payments/${cheque.payment.id}?returnTo=/cheques`
                            : "/payments"
                        }
                        className={brandSmallSecondaryButtonClassName}
                      >
                        Receipt
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/cheques/${cheque.id}`}
                        className={brandSmallPrimaryButtonClassName}
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
    </PageContainer>
  );
}
