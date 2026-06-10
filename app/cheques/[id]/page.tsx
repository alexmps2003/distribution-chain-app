import Link from "next/link";
import { notFound } from "next/navigation";
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
  const cheque = await prisma.paymentPart.findUnique({
    where: { id },
    include: {
      payment: {
        include: {
          customer: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
      allocations: {
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              amount: true,
              status: true,
            },
          },
        },
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (!cheque || cheque.method !== "CHEQUE") {
    notFound();
  }

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
            <Link
              href={`/payments/${cheque.payment.id}`}
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Payment Receipt
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
                cheque.status,
              )}`}
            >
              {formatStatus(cheque.status)}
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
              value={formatDate(cheque.chequeDate)}
            />
            <DetailItem label="Amount" value={formatAmount(cheque.amount)} />
            <DetailItem
              label="Customer"
              value={`${cheque.payment.customer.name} (${cheque.payment.customer.code})`}
            />
            <DetailItem
              label="Payment Date"
              value={formatDate(cheque.payment.paymentDate)}
            />
            <DetailItem label="Status" value={formatStatus(cheque.status)} />
          </dl>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-medium tracking-tight">
            Allocations Paid By This Cheque
          </h2>

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
                          {allocation.invoice.invoiceNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(allocation.invoice.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(allocation.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {allocation.invoice.status.replace("_", " ")}
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
          <p className="mt-1 text-sm text-zinc-600">
            Cheque reversal logic will be added next.
          </p>
          <div className="mt-4 grid gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Reason
              <textarea
                disabled
                placeholder="Reason for reversing this cheque"
                className="h-24 resize-none rounded-md border border-zinc-300 bg-zinc-100 p-3 text-sm font-normal text-zinc-500 outline-none"
              />
            </label>
            <div>
              <button
                type="button"
                disabled
                className="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-md bg-zinc-300 px-4 text-sm font-medium text-zinc-600"
              >
                Reverse Cheque
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
