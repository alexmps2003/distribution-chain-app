import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function NewPaymentPage() {
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  async function createPayment(formData: FormData) {
    "use server";

    const customerId = formData.get("customerId") as string;
    const paymentDateStr = formData.get("paymentDate") as string;
    const notes = formData.get("notes") as string;

    if (!customerId || !paymentDateStr) {
      throw new Error("Missing required fields");
    }

    const paymentDate = new Date(paymentDateStr);

    // Business logic placeholder - do not implement yet
    // For now we persist a zero amount payment
    await prisma.payment.create({
      data: {
        customerId,
        paymentDate,
        notes,
        amount: 0,
        paymentMethod: "MIXED", // Placeholder
      },
    });

    redirect("/payments");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Record Payment
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Record a new payment from a customer.
            </p>
          </div>
          <Link
            href="/payments"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
          >
            Back to Payments
          </Link>
        </div>

        <form
          action={createPayment}
          className="grid gap-6 rounded-md border border-zinc-200 bg-white p-6"
        >
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-medium tracking-tight">
              Payment Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Customer <span className="text-red-500">*</span>
                <select
                  name="customerId"
                  required
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </label>

              <Field
                label="Payment Date"
                name="paymentDate"
                type="date"
                required
              />
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
              Notes
              <textarea
                name="notes"
                placeholder="Optional notes about this payment..."
                className="h-20 resize-none rounded-md border border-zinc-300 bg-white p-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </label>
          </div>

          <div className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
            <h2 className="text-lg font-medium tracking-tight">
              Invoice Allocation
            </h2>
            <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
              Invoice allocation will be added here.
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
            <h2 className="text-lg font-medium tracking-tight">
              Payment Methods
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {["Cash", "Cheque", "Bank Transfer", "Card"].map((method) => (
                <label
                  key={method}
                  className="flex cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white p-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 has-checked:border-zinc-950 has-checked:bg-zinc-50 has-checked:ring-1 has-checked:ring-zinc-950"
                >
                  <input
                    type="checkbox"
                    name="paymentMethods"
                    value={method}
                    className="sr-only"
                  />
                  {method}
                </label>
              ))}
            </div>
            <p className="text-sm text-zinc-500">
              Payment allocation and amount entry will be added in the next
              step.
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-zinc-200 pt-6">
            <Link
              href="/payments"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  min,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
      {label} {required && <span className="text-red-500">*</span>}
      <input
        name={name}
        type={type}
        required={required}
        min={min}
        step={step}
        placeholder={placeholder}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      />
    </label>
  );
}
