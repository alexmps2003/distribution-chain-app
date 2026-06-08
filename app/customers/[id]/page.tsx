import Link from "next/link";
import { prisma } from "@/lib/prisma";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(value: { toString(): string }) {
  return numberFormatter.format(Number(value.toString()));
}

interface CustomerDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
  });

  if (!customer) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold tracking-tight">
              Customer not found
            </h1>
            <Link
              href="/customers"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Back to Customers
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const invoicesAggr = await prisma.invoice.aggregate({
    where: { customerId: id },
    _sum: { amount: true },
  });

  const allocationsAggr = await prisma.paymentAllocation.aggregate({
    where: { invoice: { customerId: id } },
    _sum: { amount: true },
  });

  const totalInvoiced = Number(invoicesAggr._sum.amount ?? 0);
  const totalCollected = Number(allocationsAggr._sum.amount ?? 0);
  const outstandingBalance = totalInvoiced - totalCollected;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {customer.name}
            </h1>
            <p className="text-sm text-zinc-600">
              Code: <span className="font-medium">{customer.code}</span>
            </p>
          </div>
          <Link
            href="/customers"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Back to Customers
          </Link>
        </div>

        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <h2 className="mb-6 text-lg font-semibold text-zinc-950">
            Financial Summary
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium uppercase text-zinc-600">
                Total Invoiced
              </label>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                {formatAmount(totalInvoiced)}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-zinc-600">
                Total Collected
              </label>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                {formatAmount(totalCollected)}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-zinc-600">
                Outstanding Balance
              </label>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                {formatAmount(outstandingBalance)}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Customer Information */}
          <section className="rounded-md border border-zinc-200 bg-white p-6">
            <h2 className="mb-6 text-lg font-semibold text-zinc-950">
              Customer Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Contact Person
                </label>
                <p className="text-sm text-zinc-950">
                  {customer.contactPerson ?? "-"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Owner Name
                </label>
                <p className="text-sm text-zinc-950">
                  {customer.ownerName ?? "-"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Phone
                </label>
                <p className="text-sm text-zinc-950">{customer.phone ?? "-"}</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  WhatsApp Number
                </label>
                <p className="text-sm text-zinc-950">
                  {customer.whatsappNumber ?? "-"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Email
                </label>
                <p className="text-sm text-zinc-950">{customer.email ?? "-"}</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Address
                </label>
                <p className="text-sm text-zinc-950">
                  {customer.address ?? "-"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Area
                </label>
                <p className="text-sm text-zinc-950">{customer.area ?? "-"}</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Route Name
                </label>
                <p className="text-sm text-zinc-950">
                  {customer.routeName ?? "-"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Assigned Sales Rep
                </label>
                <p className="text-sm text-zinc-950">
                  {customer.assignedSalesRep ?? "-"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Assigned Collector
                </label>
                <p className="text-sm text-zinc-950">
                  {customer.assignedCollector ?? "-"}
                </p>
              </div>
            </div>
          </section>

          {/* Financial Information */}
          <section className="rounded-md border border-zinc-200 bg-white p-6">
            <h2 className="mb-6 text-lg font-semibold text-zinc-950">
              Financial Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Credit Limit
                </label>
                <p className="text-sm font-medium text-zinc-950">
                  {formatAmount(customer.creditLimit)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Opening Outstanding
                </label>
                <p className="text-sm font-medium text-zinc-950">
                  {formatAmount(customer.openingOutstanding)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Payment Terms (Days)
                </label>
                <p className="text-sm text-zinc-950">
                  {customer.paymentTermsDays}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-600">
                  Status
                </label>
                <div className="mt-1">
                  <span
                    className={
                      customer.isActive
                        ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                        : "inline-flex rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700"
                    }
                  >
                    {customer.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* System Information */}
        <section className="rounded-md border border-zinc-200 bg-white p-6">
          <h2 className="mb-6 text-lg font-semibold text-zinc-950">
            System Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase text-zinc-600">
                Customer ID
              </label>
              <p className="text-sm text-zinc-950 font-mono">{customer.id}</p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-zinc-600">
                Customer Code
              </label>
              <p className="text-sm text-zinc-950">{customer.code}</p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-zinc-600">
                Created Date
              </label>
              <p className="text-sm text-zinc-950">
                {customer.createdAt.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
