import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import CustomerSelect from "./CustomerSelect";
import PaymentMethodEntry from "./PaymentMethodEntry";

type OutstandingInvoice = Prisma.InvoiceGetPayload<{
  include: {
    payments: {
      select: {
        amount: true;
      };
    };
  };
}>;

export default async function NewPaymentPage(props: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const customerId = searchParams?.customerId;

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  let outstandingInvoices: OutstandingInvoice[] = [];
  if (customerId) {
    outstandingInvoices = await prisma.invoice.findMany({
      where: {
        customerId,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
      include: {
        payments: {
          select: {
            amount: true,
          },
        },
      },
      orderBy: { invoiceDate: "asc" },
    });
  }

  const allocationInvoices = outstandingInvoices
    .map((invoice) => {
      const previousAllocated = invoice.payments.reduce((total, allocation) => {
        return total + Number(allocation.amount.toString());
      }, 0);
      const outstandingAmount =
        Number(invoice.amount.toString()) - previousAllocated;

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate?.toISOString() ?? null,
        invoiceTotal: invoice.amount.toString(),
        outstandingAmount: outstandingAmount.toFixed(2),
        status: invoice.status,
      };
    })
    .filter((invoice) => Number(invoice.outstandingAmount) > 0);

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

        <form className="grid gap-6 rounded-md border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-medium tracking-tight">
              Payment Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Customer <span className="text-red-500">*</span>
                <CustomerSelect customers={customers} />
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

          <PaymentMethodEntry
            customerId={customerId}
            invoices={allocationInvoices}
          />

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
