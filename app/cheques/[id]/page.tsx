import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api-client-server";
import { withToast } from "@/lib/toast";
import ReverseChequeButton from "./ReverseChequeButton";
import UndoChequeReversalButton from "./UndoChequeReversalButton";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type MoneyValue = string | number;

type ChequeResponse = {
  amount: MoneyValue;
  allocations: {
    amount: MoneyValue;
    id: string;
    invoice: {
      amount: MoneyValue;
      invoiceNumber: string;
      status: string;
    } | null;
  }[];
  chequeBank: string | null;
  chequeDate: string | null;
  chequeNumber: string | null;
  id: string;
  payment: {
    customer: {
      code: string;
      name: string;
    } | null;
    paymentDate: string;
  } | null;
  reversalReason: string | null;
  reversedAt: string | null;
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

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

async function reverseCheque(formData: FormData) {
  "use server";

  const chequeId = getString(formData, "chequeId");
  const reversalReason = getString(formData, "reversalReason");

  if (!chequeId) {
    throw new Error("Cheque id is required");
  }

  if (!reversalReason) {
    throw new Error("Reversal reason is required");
  }

  await apiPatch<unknown, { reversalReason: string }>(
    `/cheques/${encodeURIComponent(chequeId)}/reverse`,
    { reversalReason },
  );

  redirect(withToast(`/cheques/${chequeId}`, "success", "Cheque reversed"));
}

async function undoChequeReversal(formData: FormData) {
  "use server";

  const chequeId = getString(formData, "chequeId");

  if (!chequeId) {
    throw new Error("Cheque id is required");
  }

  await apiPatch<unknown, Record<string, never>>(
    `/cheques/${encodeURIComponent(chequeId)}/undo-reversal`,
    {},
  );

  redirect(
    withToast(`/cheques/${chequeId}`, "success", "Cheque reversal undone"),
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-zinc-950">{value}</dd>
    </div>
  );
}

export default async function ChequeDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let cheque: ChequeResponse | null;

  try {
    cheque = await apiGet<ChequeResponse | null>(
      `/cheques/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("failed with 404")) {
      notFound();
    }

    throw error;
  }

  if (!cheque) {
    notFound();
  }

  cheque = {
    ...cheque,
    allocations: [...cheque.allocations].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };

  const chequeStatus = normalizePaymentPartStatus(cheque.status);
  const isReversed = chequeStatus === "REVERSED";

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">
            Cheque Details
          </h1>
          <div className="flex gap-3">
            <Link
              href="/cheques"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
            >
              Back to Cheques
            </Link>
          </div>
        </div>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-medium tracking-tight">
                Cheque Summary
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Cheque #{cheque.chequeNumber ?? "-"}
              </p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                chequeStatus,
              )}`}
            >
              {formatStatus(chequeStatus)}
            </span>
          </div>

          <dl className="mt-6 grid gap-4 border-t border-zinc-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem
              label="Cheque Number"
              value={cheque.chequeNumber ?? "-"}
            />
            <DetailItem label="Bank" value={cheque.chequeBank ?? "-"} />
            <DetailItem
              label="Cheque Date"
              value={formatDate(
                cheque.chequeDate ? new Date(cheque.chequeDate) : null,
              )}
            />
            <DetailItem label="Amount" value={formatAmount(cheque.amount)} />
            <DetailItem
              label="Customer"
              value={
                cheque.payment?.customer
                  ? `${cheque.payment.customer.name} (${cheque.payment.customer.code})`
                  : "Customer not found"
              }
            />
            <DetailItem
              label="Payment Date"
              value={formatDate(
                cheque.payment ? new Date(cheque.payment.paymentDate) : null,
              )}
            />
            <DetailItem label="Status" value={formatStatus(chequeStatus)} />
          </dl>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-medium tracking-tight">
            Allocations Paid By This Cheque
          </h2>
          {isReversed && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
              This cheque has been reversed. These allocations no longer count
              toward invoice payments.
            </div>
          )}

          {cheque.allocations.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
              No allocations found for this cheque.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-zinc-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Invoice Number
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Invoice Total
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Amount Allocated By This Cheque
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Current Invoice Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {cheque.allocations.map((allocation) => (
                      <tr key={allocation.id}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950">
                          {allocation.invoice?.invoiceNumber ?? "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {allocation.invoice
                            ? formatAmount(allocation.invoice.amount)
                            : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(allocation.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {allocation.invoice?.status.replace("_", " ") ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-medium tracking-tight">
            Cheque Reversal
          </h2>
          {isReversed ? (
            <div className="mt-4 grid gap-4">
              <span
                className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                  chequeStatus,
                )}`}
              >
                Reversed
              </span>
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Reversed Date"
                  value={formatDate(
                    cheque.reversedAt ? new Date(cheque.reversedAt) : null,
                  )}
                />
                <DetailItem
                  label="Reversal Reason"
                  value={cheque.reversalReason ?? "-"}
                />
              </dl>
              <form action={undoChequeReversal}>
                <input type="hidden" name="chequeId" value={cheque.id} />
                <UndoChequeReversalButton />
              </form>
            </div>
          ) : (
            <form action={reverseCheque} className="mt-4 grid gap-4">
              <input type="hidden" name="chequeId" value={cheque.id} />
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Reason
                <textarea
                  name="reversalReason"
                  required
                  placeholder="Reason for reversing this cheque"
                  className="h-24 resize-none rounded-md border border-zinc-300 bg-white p-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </label>
              <div>
                <ReverseChequeButton />
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
