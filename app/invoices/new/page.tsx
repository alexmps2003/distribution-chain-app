import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function NewInvoicePage() {
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  async function createInvoice(formData: FormData) {
    "use server";

    const customerId = formData.get("customerId") as string;
    const invoiceNumber = formData.get("invoiceNumber") as string;
    const invoiceDateStr = formData.get("invoiceDate") as string;
    const dueDateStr = formData.get("dueDate") as string;
    const amountStr = formData.get("amount") as string;

    if (!customerId || !invoiceNumber || !invoiceDateStr || !amountStr) {
      throw new Error("Missing required fields");
    }

    const amount = Number(amountStr);
    const invoiceDate = new Date(invoiceDateStr);
    const dueDate = dueDateStr ? new Date(dueDateStr) : undefined;

    await prisma.invoice.create({
      data: {
        customerId,
        invoiceNumber,
        amount,
        invoiceDate,
        dueDate,
        status: "UNPAID",
      },
    });

    redirect("/invoices");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              New Invoice
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Create a new invoice for a customer.
            </p>
          </div>
          <Link
            href="/invoices"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
          >
            Back to Invoices
          </Link>
        </div>

        <form
          action={createInvoice}
          className="grid gap-6 rounded-md border border-zinc-200 bg-white p-6"
        >
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

            <Field label="Invoice Number" name="invoiceNumber" required />
            <Field
              label="Invoice Date"
              name="invoiceDate"
              type="date"
              required
            />
            <Field label="Due Date" name="dueDate" type="date" />
            <Field
              label="Amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              required
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-zinc-200 pt-6">
            <Link
              href="/invoices"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Create Invoice
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
