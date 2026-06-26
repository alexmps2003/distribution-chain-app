import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getValidationErrorMessage } from "@/lib/validation/errors";
import { parseCustomerFormData } from "@/lib/validation/customer";

const customerFormFields = [
  "address",
  "area",
  "assignedCollector",
  "assignedSalesRep",
  "code",
  "contactPerson",
  "creditLimit",
  "email",
  "name",
  "ownerName",
  "paymentTermsDays",
  "phone",
  "routeName",
  "whatsappNumber",
] as const;

type CustomerSearchParams = {
  [key: string]: string | string[] | undefined;
  error?: string;
};

function getFormValue(
  searchParams: CustomerSearchParams,
  name: string,
): string | undefined {
  const value = searchParams[name];

  return Array.isArray(value) ? value[0] : value;
}

function buildInvalidCustomerHref(formData: FormData, message: string) {
  const params = new URLSearchParams({ error: message });

  for (const field of customerFormFields) {
    const value = formData.get(field);

    params.set(field, typeof value === "string" ? value : "");
  }

  return `/customers/new?${params.toString()}`;
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

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<CustomerSearchParams>;
}) {
  const submittedValues = await searchParams;
  const error = getFormValue(submittedValues, "error");

  async function createCustomer(formData: FormData) {
    "use server";

    let customer;

    try {
      customer = parseCustomerFormData(formData);
    } catch (validationError) {
      redirect(
        buildInvalidCustomerHref(
          formData,
          getValidationErrorMessage(validationError),
        ),
      );
    }

    await prisma.customer.create({
      data: {
        code: customer.code,
        name: customer.name,
        ownerName: customer.ownerName,
        contactPerson: customer.contactPerson,
        phone: customer.phone,
        whatsappNumber: customer.whatsappNumber,
        email: customer.email,
        address: customer.address,
        area: customer.area,
        routeName: customer.routeName,
        assignedSalesRep: customer.assignedSalesRep,
        assignedCollector: customer.assignedCollector,
        creditLimit: customer.creditLimit,
        paymentTermsDays: customer.paymentTermsDays,
      },
    });

    redirect("/customers");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
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
          noValidate
          className="grid gap-6 rounded-md border border-zinc-200 bg-white p-6"
        >
          <ErrorMessage message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Code"
              name="code"
              required
              defaultValue={getFormValue(submittedValues, "code")}
            />
            <Field
              label="Name"
              name="name"
              required
              defaultValue={getFormValue(submittedValues, "name")}
            />
            <Field
              label="Owner Name"
              name="ownerName"
              defaultValue={getFormValue(submittedValues, "ownerName")}
            />
            <Field
              label="Contact Person"
              name="contactPerson"
              defaultValue={getFormValue(submittedValues, "contactPerson")}
            />
            <Field
              label="Phone"
              name="phone"
              defaultValue={getFormValue(submittedValues, "phone")}
            />
            <Field
              label="WhatsApp Number"
              name="whatsappNumber"
              defaultValue={getFormValue(submittedValues, "whatsappNumber")}
            />
            <Field
              label="Email"
              name="email"
              defaultValue={getFormValue(submittedValues, "email")}
            />
            <Field
              label="Address"
              name="address"
              defaultValue={getFormValue(submittedValues, "address")}
            />
            <Field
              label="Area"
              name="area"
              defaultValue={getFormValue(submittedValues, "area")}
            />
            <Field
              label="Route Name"
              name="routeName"
              defaultValue={getFormValue(submittedValues, "routeName")}
            />
            <Field
              label="Assigned Sales Rep"
              name="assignedSalesRep"
              defaultValue={getFormValue(submittedValues, "assignedSalesRep")}
            />
            <Field
              label="Assigned Collector"
              name="assignedCollector"
              defaultValue={getFormValue(submittedValues, "assignedCollector")}
            />
            <Field
              label="Credit Limit"
              name="creditLimit"
              type="number"
              placeholder="0.00"
              defaultValue={getFormValue(submittedValues, "creditLimit")}
            />
            <Field
              label="Payment Terms Days"
              name="paymentTermsDays"
              type="number"
              placeholder="0"
              defaultValue={getFormValue(submittedValues, "paymentTermsDays")}
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
