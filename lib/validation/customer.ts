import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const sriLankanPhone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine(
    (value) => value === "" || /^(?:\+94|0)\d{9}$/.test(value),
    "Phone number must be a valid Sri Lankan number",
  )
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const decimalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? "0" : value))
  .refine((value) => Number.isFinite(Number(value)), "Amount must be valid")
  .refine((value) => Number(value) >= 0, "Amount cannot be negative");

const nonNegativeInteger = z
  .string()
  .trim()
  .transform((value) => (value === "" ? "0" : value))
  .refine((value) => /^\d+$/.test(value), "Payment terms must be zero or positive")
  .transform((value) => Number.parseInt(value, 10));

export const customerValidationSchema = z.object({
  address: optionalText,
  area: optionalText,
  assignedCollector: optionalText,
  assignedSalesRep: optionalText,
  code: z.string().trim().min(1, "Customer code is required"),
  contactPerson: optionalText,
  creditLimit: decimalString,
  email: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(z.email("Email must be valid").optional()),
  isActive: z.enum(["true", "false"]).optional(),
  name: z.string().trim().min(1, "Customer name is required"),
  ownerName: optionalText,
  paymentTermsDays: nonNegativeInteger,
  phone: sriLankanPhone,
  routeName: optionalText,
  whatsappNumber: sriLankanPhone,
});

export type CustomerValidationInput = z.infer<typeof customerValidationSchema>;

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

export function parseCustomerFormData(formData: FormData) {
  return customerValidationSchema.parse({
    address: getString(formData, "address"),
    area: getString(formData, "area"),
    assignedCollector: getString(formData, "assignedCollector"),
    assignedSalesRep: getString(formData, "assignedSalesRep"),
    code: getString(formData, "code"),
    contactPerson: getString(formData, "contactPerson"),
    creditLimit: getString(formData, "creditLimit"),
    email: getString(formData, "email"),
    isActive: getString(formData, "isActive") || undefined,
    name: getString(formData, "name"),
    ownerName: getString(formData, "ownerName"),
    paymentTermsDays: getString(formData, "paymentTermsDays"),
    phone: getString(formData, "phone"),
    routeName: getString(formData, "routeName"),
    whatsappNumber: getString(formData, "whatsappNumber"),
  });
}
