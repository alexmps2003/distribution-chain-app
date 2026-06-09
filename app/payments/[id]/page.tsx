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

function formatMethod(method: string) {
  return method.replace("_", " ");
}

export default async function PaymentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          code: true,
          name: true,
          phone: true,
          area: true,
          routeName: true,
        },
      },
      parts: {
        orderBy: { createdAt: "asc" },
      },
      allocations: {
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              amount: true,
              invoiceDate: true,
              dueDate: true,
              status: true,
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!payment) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Payment Details
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {payment.customer.name} ({payment.customer.code})
            </p>
          </div>
          <Link
            href="/payments"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
          >
            Back to Payments
          </Link>
        </div>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-medium tracking-tight">
            Payment Details
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Customer" value={payment.customer.name} />
            <DetailItem label="Customer Code" value={payment.customer.code} />
            <DetailItem label="Payment Date" value={formatDate(payment.paymentDate)} />
            <DetailItem label="Amount" value={formatAmount(payment.amount)} />
            <DetailItem label="Payment Method" value={payment.paymentMethod} />
            <DetailItem label="Area" value={payment.customer.area ?? "-"} />
            <DetailItem label="Route" value={payment.customer.routeName ?? "-"} />
            <DetailItem label="Created" value={formatDate(payment.createdAt)} />
          </dl>
          {payment.notes && (
            <div className="mt-4 border-t border-zinc-200 pt-4">
              <p className="text-xs font-semibold uppercase text-zinc-500">
                Notes
              </p>
              <p className="mt-1 text-sm text-zinc-700">{payment.notes}</p>
            </div>
          )}
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-medium tracking-tight">
            Payment Methods
          </h2>
          {payment.parts.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
              No payment method details found.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-zinc-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Method
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Reference
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Cheque Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {payment.parts.map((part) => (
                      <tr key={part.id}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950">
                          {formatMethod(part.method)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(part.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {part.chequeNumber ??
                            part.bankReference ??
                            part.cardReference ??
                            "-"}
                          {part.chequeBank ? ` (${part.chequeBank})` : ""}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {formatDate(part.chequeDate)}
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
            Invoice Allocations
          </h2>
          {payment.allocations.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
              No invoice allocations found.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-zinc-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Invoice
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Invoice Date
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Due Date
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Invoice Total
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Allocated
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {payment.allocations.map((allocation) => (
                      <tr key={allocation.id}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950">
                          {allocation.invoice.invoiceNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {formatDate(allocation.invoice.invoiceDate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {formatDate(allocation.invoice.dueDate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(allocation.invoice.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(allocation.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700">
                            {allocation.invoice.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
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
