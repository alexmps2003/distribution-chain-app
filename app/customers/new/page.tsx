import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getOptionalString(formData: FormData, name: string) {
  const value = getString(formData, name);

  return value === "" ? undefined : value;
}

function getDecimalString(formData: FormData, name: string) {
  const value = getString(formData, name);

  return value === "" ? "0" : value;
}

function getInt(formData: FormData, name: string) {
  const value = getString(formData, name);

  return value === "" ? 0 : Number.parseInt(value, 10);
}

export default function NewCustomerPage() {
  async function createCustomer(formData: FormData) {
    "use server";

    const code = getString(formData, "code");
    const name = getString(formData, "name");

    if (!code) {
      throw new Error("Customer code is required");
    }

    if (!name) {
      throw new Error("Customer name is required");
    }

    await prisma.customer.create({
      data: {
        code,
        name,
        ownerName: getOptionalString(formData, "ownerName"),
        contactPerson: getOptionalString(formData, "contactPerson"),
        phone: getOptionalString(formData, "phone"),
        whatsappNumber: getOptionalString(formData, "whatsappNumber"),
        email: getOptionalString(formData, "email"),
        address: getOptionalString(formData, "address"),
        area: getOptionalString(formData, "area"),
        routeName: getOptionalString(formData, "routeName"),
        assignedSalesRep: getOptionalString(formData, "assignedSalesRep"),
        assignedCollector: getOptionalString(formData, "assignedCollector"),
        creditLimit: getDecimalString(formData, "creditLimit"),
        openingOutstanding: getDecimalString(formData, "openingOutstanding"),
        paymentTermsDays: getInt(formData, "paymentTermsDays"),
      },
    });

    redirect("/customers");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              New Customer
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Create a customer profile for distribution tracking.
            </p>
          </div>
          <Link
            href="/customers"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
          >
            Back to Customers
          </Link>
        </div>

        <form
          action={createCustomer}
          className="grid gap-6 rounded-md border border-zinc-200 bg-white p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" name="code" required />
            <Field label="Name" name="name" required />
            <Field label="Owner Name" name="ownerName" />
            <Field label="Contact Person" name="contactPerson" />
            <Field label="Phone" name="phone" />
            <Field label="WhatsApp Number" name="whatsappNumber" />
            <Field label="Email" name="email" type="email" />
            <Field label="Address" name="address" />
            <Field label="Area" name="area" />
            <Field label="Route Name" name="routeName" />
            <Field label="Assigned Sales Rep" name="assignedSalesRep" />
            <Field label="Assigned Collector" name="assignedCollector" />
            <Field
              label="Credit Limit"
              name="creditLimit"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
            <Field
              label="Opening Outstanding"
              name="openingOutstanding"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
            <Field
              label="Payment Terms Days"
              name="paymentTermsDays"
              type="number"
              min="0"
              step="1"
              placeholder="0"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-zinc-200 pt-6">
            <Link
              href="/customers"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Create Customer
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
      {label}
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
