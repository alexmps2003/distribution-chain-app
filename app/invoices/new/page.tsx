import Link from "next/link";
import { redirect } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api-client-server";
import { withToast } from "@/lib/toast";
import { getValidationErrorMessage } from "@/lib/validation/errors";
import { parseInvoiceFormData } from "@/lib/validation/invoice";

const invoiceFormFields = [
  "amount",
  "customerId",
  "dueDate",
  "invoiceDate",
  "invoiceNumber",
] as const;

type CustomerListRow = {
  customer: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  };
};

type InvoiceSearchParams = {
  [key: string]: string | string[] | undefined;
  error?: string;
};

function getFormValue(
  searchParams: InvoiceSearchParams,
  name: string,
): string | undefined {
  const value = searchParams[name];

  return Array.isArray(value) ? value[0] : value;
}

function buildInvalidInvoiceHref(formData: FormData, message: string) {
  const params = new URLSearchParams({ error: message });

  for (const field of invoiceFormFields) {
    const value = formData.get(field);

    params.set(field, typeof value === "string" ? value : "");
  }

  return `/invoices/new?${params.toString()}`;
}

function ErrorMessage({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {message}
    </div>
  );
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<InvoiceSearchParams>;
}) {
  const submittedValues = await searchParams;
  const error = getFormValue(submittedValues, "error");
  const customers = (await apiGet<CustomerListRow[]>("/customers"))
    .map(({ customer }) => customer)
    .filter((customer) => customer.isActive)
    .sort((left, right) => left.name.localeCompare(right.name));

  async function createInvoice(formData: FormData) {
    "use server";

    let invoice;

    try {
      invoice = parseInvoiceFormData(formData);
    } catch (validationError) {
      redirect(
        buildInvalidInvoiceHref(
          formData,
          getValidationErrorMessage(validationError),
        ),
      );
    }

    await apiPost("/invoices", {
      customerId: invoice.customerId,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
    });

    redirect(withToast("/invoices", "success", "Invoice created"));
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
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
          noValidate
          className="grid gap-6 rounded-md border border-zinc-200 bg-white p-6"
        >
          <ErrorMessage message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Customer <span className="text-red-500">*</span>
              <select
                name="customerId"
                defaultValue={getFormValue(submittedValues, "customerId") ?? ""}
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
              label="Invoice Number"
              name="invoiceNumber"
              required
              defaultValue={getFormValue(submittedValues, "invoiceNumber")}
            />
            <Field
              label="Invoice Date"
              name="invoiceDate"
              type="date"
              required
              defaultValue={getFormValue(submittedValues, "invoiceDate")}
            />
            <Field
              label="Due Date"
              name="dueDate"
              type="date"
              defaultValue={getFormValue(submittedValues, "dueDate")}
            />
            <Field
              label="Amount"
              name="amount"
              type="number"
              placeholder="0.00"
              required
              defaultValue={getFormValue(submittedValues, "amount")}
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
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
      {label} {required && <span className="text-red-500">*</span>}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      />
    </label>
  );
}
