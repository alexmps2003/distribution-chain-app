import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { withToast } from "@/lib/toast";
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
  "isActive",
  "name",
  "ownerName",
  "paymentTermsDays",
  "phone",
  "routeName",
  "whatsappNumber",
] as const;

interface EditCustomerPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
    error?: string;
  }>;
}

function getFormValue(
  searchParams: Awaited<EditCustomerPageProps["searchParams"]>,
  name: string,
): string | undefined {
  const value = searchParams[name];

  return Array.isArray(value) ? value[0] : value;
}

function buildInvalidCustomerHref(
  customerId: string,
  formData: FormData,
  message: string,
) {
  const params = new URLSearchParams({ error: message });

  for (const field of customerFormFields) {
    const value = formData.get(field);

    params.set(field, typeof value === "string" ? value : "");
  }

  return `/customers/${customerId}/edit?${params.toString()}`;
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
  const submittedValues = await searchParams;
  const error = getFormValue(submittedValues, "error");
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
        buildInvalidCustomerHref(
          id,
          formData,
          getValidationErrorMessage(validationError),
        ),
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

    redirect(withToast(`/customers/${id}`, "success", "Customer updated"));
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
          noValidate
          className="grid gap-6 rounded-md border border-zinc-200 bg-white p-6"
        >
          <ErrorMessage message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Code"
              name="code"
              required
              defaultValue={getFormValue(submittedValues, "code") ?? customer.code}
            />
            <Field
              label="Name"
              name="name"
              required
              defaultValue={getFormValue(submittedValues, "name") ?? customer.name}
            />
            <Field
              label="Owner Name"
              name="ownerName"
              defaultValue={
                getFormValue(submittedValues, "ownerName") ??
                customer.ownerName ??
                ""
              }
            />
            <Field
              label="Contact Person"
              name="contactPerson"
              defaultValue={
                getFormValue(submittedValues, "contactPerson") ??
                customer.contactPerson ??
                ""
              }
            />
            <Field
              label="Phone"
              name="phone"
              defaultValue={
                getFormValue(submittedValues, "phone") ?? customer.phone ?? ""
              }
            />
            <Field
              label="WhatsApp Number"
              name="whatsappNumber"
              defaultValue={
                getFormValue(submittedValues, "whatsappNumber") ??
                customer.whatsappNumber ??
                ""
              }
            />
            <Field
              label="Email"
              name="email"
              defaultValue={
                getFormValue(submittedValues, "email") ?? customer.email ?? ""
              }
            />
            <Field
              label="Address"
              name="address"
              defaultValue={
                getFormValue(submittedValues, "address") ??
                customer.address ??
                ""
              }
            />
            <Field
              label="Area"
              name="area"
              defaultValue={
                getFormValue(submittedValues, "area") ?? customer.area ?? ""
              }
            />
            <Field
              label="Route Name"
              name="routeName"
              defaultValue={
                getFormValue(submittedValues, "routeName") ??
                customer.routeName ??
                ""
              }
            />
            <Field
              label="Assigned Sales Rep"
              name="assignedSalesRep"
              defaultValue={
                getFormValue(submittedValues, "assignedSalesRep") ??
                customer.assignedSalesRep ??
                ""
              }
            />
            <Field
              label="Assigned Collector"
              name="assignedCollector"
              defaultValue={
                getFormValue(submittedValues, "assignedCollector") ??
                customer.assignedCollector ??
                ""
              }
            />
            <Field
              label="Credit Limit"
              name="creditLimit"
              type="number"
              placeholder="0.00"
              defaultValue={
                getFormValue(submittedValues, "creditLimit") ??
                customer.creditLimit.toString()
              }
            />
            <Field
              label="Payment Terms Days"
              name="paymentTermsDays"
              type="number"
              placeholder="0"
              defaultValue={
                getFormValue(submittedValues, "paymentTermsDays") ??
                customer.paymentTermsDays.toString()
              }
            />
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Is Active
              <select
                name="isActive"
                defaultValue={
                  getFormValue(submittedValues, "isActive") ??
                  (customer.isActive ? "true" : "false")
                }
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
