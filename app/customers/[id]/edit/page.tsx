import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getValidationErrorMessage } from "@/lib/validation/errors";
import { parseCustomerFormData } from "@/lib/validation/customer";

interface EditCustomerPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
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

export default async function EditCustomerPage({
  params,
  searchParams,
}: EditCustomerPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const customer = await prisma.customer.findUnique({
    where: { id },
  });

  if (!customer) {
    notFound();
  }

  async function updateCustomer(formData: FormData) {
    "use server";

    let customerInput;

    try {
      customerInput = parseCustomerFormData(formData);
    } catch (validationError) {
      redirect(
        `/customers/${id}/edit?error=${encodeURIComponent(
          getValidationErrorMessage(validationError),
        )}`,
      );
    }

    await prisma.customer.update({
      where: { id },
      data: {
        code: customerInput.code,
        name: customerInput.name,
        ownerName: customerInput.ownerName,
        contactPerson: customerInput.contactPerson,
        phone: customerInput.phone,
        whatsappNumber: customerInput.whatsappNumber,
        email: customerInput.email,
        address: customerInput.address,
        area: customerInput.area,
        routeName: customerInput.routeName,
        assignedSalesRep: customerInput.assignedSalesRep,
        assignedCollector: customerInput.assignedCollector,
        creditLimit: customerInput.creditLimit,
        paymentTermsDays: customerInput.paymentTermsDays,
        isActive: customerInput.isActive === "true",
      },
    });

    redirect(`/customers/${id}`);
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Edit Customer
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Update the customer profile.
            </p>
          </div>
          <Link
            href={`/customers/${id}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
          >
            Back to Customer
          </Link>
        </div>

        <form
          action={updateCustomer}
          className="grid gap-6 rounded-md border border-zinc-200 bg-white p-6"
        >
          <ErrorMessage message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Code"
              name="code"
              required
              defaultValue={customer.code}
            />
            <Field
              label="Name"
              name="name"
              required
              defaultValue={customer.name}
            />
            <Field
              label="Owner Name"
              name="ownerName"
              defaultValue={customer.ownerName ?? ""}
            />
            <Field
              label="Contact Person"
              name="contactPerson"
              defaultValue={customer.contactPerson ?? ""}
            />
            <Field
              label="Phone"
              name="phone"
              defaultValue={customer.phone ?? ""}
            />
            <Field
              label="WhatsApp Number"
              name="whatsappNumber"
              defaultValue={customer.whatsappNumber ?? ""}
            />
            <Field
              label="Email"
              name="email"
              type="email"
              defaultValue={customer.email ?? ""}
            />
            <Field
              label="Address"
              name="address"
              defaultValue={customer.address ?? ""}
            />
            <Field
              label="Area"
              name="area"
              defaultValue={customer.area ?? ""}
            />
            <Field
              label="Route Name"
              name="routeName"
              defaultValue={customer.routeName ?? ""}
            />
            <Field
              label="Assigned Sales Rep"
              name="assignedSalesRep"
              defaultValue={customer.assignedSalesRep ?? ""}
            />
            <Field
              label="Assigned Collector"
              name="assignedCollector"
              defaultValue={customer.assignedCollector ?? ""}
            />
            <Field
              label="Credit Limit"
              name="creditLimit"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              defaultValue={customer.creditLimit.toString()}
            />
            <Field
              label="Payment Terms Days"
              name="paymentTermsDays"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              defaultValue={customer.paymentTermsDays.toString()}
            />
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Is Active
              <select
                name="isActive"
                defaultValue={customer.isActive ? "true" : "false"}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-zinc-200 pt-6">
            <Link
              href={`/customers/${id}`}
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Save Customer
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
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        min={min}
        step={step}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      />
    </label>
  );
}
