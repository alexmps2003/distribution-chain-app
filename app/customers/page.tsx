import Link from "next/link";
import { prisma } from "@/lib/prisma";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(value: { toString(): string }) {
  return numberFormatter.format(Number(value.toString()));
}

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      area: true,
      routeName: true,
      assignedCollector: true,
      openingOutstanding: true,
      isActive: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Customers</h1>
          <Link
            href="/customers/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            New Customer
          </Link>
        </div>

        {customers.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
            No customers found.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Code
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Shop Name
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Area
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Route
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Assigned Collector
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Opening Outstanding
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {customer.code}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {customer.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {customer.area ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {customer.routeName ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {customer.assignedCollector ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-600">
                        {formatAmount(customer.openingOutstanding)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={
                            customer.isActive
                              ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                              : "inline-flex rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700"
                          }
                        >
                          {customer.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 items-center justify-center rounded-md bg-zinc-950 px-3 text-xs font-medium text-white hover:bg-zinc-800"
                          >
                            Edit
                          </button>
                        </div>
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
