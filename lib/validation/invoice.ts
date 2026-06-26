import { z } from "zod";

function isValidDateString(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export const invoiceValidationSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "Invoice amount is required")
    .refine((value) => Number.isFinite(Number(value)), "Invoice amount must be valid")
    .refine((value) => Number(value) > 0, "Invoice amount must be greater than zero"),
  customerId: z.string().trim().min(1, "Customer is required"),
  dueDate: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || isValidDateString(value),
      "Due date must be valid",
    )
    .transform((value) => (value === "" ? undefined : new Date(value))),
  invoiceDate: z
    .string()
    .trim()
    .min(1, "Invoice date is required")
    .refine(isValidDateString, "Invoice date must be valid")
    .transform((value) => new Date(value)),
  invoiceNumber: z.string().trim().min(1, "Invoice number is required"),
});

export type InvoiceValidationInput = z.infer<typeof invoiceValidationSchema>;

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

export function parseInvoiceFormData(formData: FormData) {
  return invoiceValidationSchema.parse({
    amount: getString(formData, "amount"),
    customerId: getString(formData, "customerId"),
    dueDate: getString(formData, "dueDate"),
    invoiceDate: getString(formData, "invoiceDate"),
    invoiceNumber: getString(formData, "invoiceNumber"),
  });
}
