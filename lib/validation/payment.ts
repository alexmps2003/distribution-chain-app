import { Prisma } from "@prisma/client";
import { z } from "zod";

const paymentMethodSchema = z.enum(["CASH", "CHEQUE", "BANK_TRANSFER", "CARD"]);

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function getDecimal(value: string, message: string) {
  try {
    const amount = new Prisma.Decimal(value || "0");

    return amount;
  } catch {
    throw new z.ZodError([
      {
        code: "custom",
        input: value,
        message,
        path: [],
      },
    ]);
  }
}

function isValidDateString(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export const paymentValidationSchema = z
  .object({
    allocations: z
      .array(
        z.object({
          amount: z.instanceof(Prisma.Decimal),
          invoiceId: z.string().min(1, "Invoice is required"),
        }),
      )
      .min(1, "Select at least one invoice allocation"),
    customerId: z.string().trim().min(1, "Customer is required"),
    methods: z
      .array(
        z.object({
          allocations: z
            .array(
              z.object({
                amount: z.instanceof(Prisma.Decimal),
                invoiceId: z.string().min(1, "Invoice is required"),
              }),
            )
            .min(1, "Each payment method needs at least one allocation"),
          amount: z.instanceof(Prisma.Decimal),
          bankReference: z.string().optional(),
          cardReference: z.string().optional(),
          chequeBank: z.string().optional(),
          chequeDate: z.date().optional(),
          chequeNumber: z.string().optional(),
          clientId: z.string().min(1),
          method: paymentMethodSchema,
        }),
      )
      .min(1, "Add at least one payment method before saving"),
    notes: z.string().optional(),
    paymentDate: z.date(),
  })
  .superRefine((value, context) => {
    const paymentTotal = value.methods.reduce(
      (total, method) => total.plus(method.amount),
      new Prisma.Decimal(0),
    );
    const allocationTotal = value.allocations.reduce(
      (total, allocation) => total.plus(allocation.amount),
      new Prisma.Decimal(0),
    );

    if (!paymentTotal.gt(0)) {
      context.addIssue({
        code: "custom",
        message: "Payment amount must be greater than zero",
        path: ["methods"],
      });
    }

    if (allocationTotal.gt(paymentTotal)) {
      context.addIssue({
        code: "custom",
        message: "Total allocated amount cannot exceed payment amount",
        path: ["allocations"],
      });
    }

    for (const allocation of value.allocations) {
      if (!allocation.amount.gt(0)) {
        context.addIssue({
          code: "custom",
          message: "Allocation amounts must be greater than zero",
          path: ["allocations"],
        });
      }
    }

    for (const [index, method] of value.methods.entries()) {
      const methodAllocationTotal = method.allocations.reduce(
        (total, allocation) => total.plus(allocation.amount),
        new Prisma.Decimal(0),
      );

      if (!method.amount.gt(0)) {
        context.addIssue({
          code: "custom",
          message: "Payment method amount must be greater than zero",
          path: ["methods", index, "amount"],
        });
      }

      if (!method.amount.equals(methodAllocationTotal)) {
        context.addIssue({
          code: "custom",
          message: "Each method amount must equal its method allocations",
          path: ["methods", index, "allocations"],
        });
      }

      for (const allocation of method.allocations) {
        if (!allocation.amount.gt(0)) {
          context.addIssue({
            code: "custom",
            message: "Allocation amounts must be greater than zero",
            path: ["methods", index, "allocations"],
          });
        }
      }

      if (method.method === "CHEQUE") {
        if (!method.chequeNumber) {
          context.addIssue({
            code: "custom",
            message: "Cheque number is required",
            path: ["methods", index, "chequeNumber"],
          });
        }

        if (!method.chequeBank) {
          context.addIssue({
            code: "custom",
            message: "Cheque bank is required",
            path: ["methods", index, "chequeBank"],
          });
        }

        if (!method.chequeDate) {
          context.addIssue({
            code: "custom",
            message: "Cheque date is required",
            path: ["methods", index, "chequeDate"],
          });
        }
      }
    }
  });

export type PaymentValidationInput = z.infer<typeof paymentValidationSchema>;

function parseDate(value: string, message: string) {
  if (!value || !isValidDateString(value)) {
    throw new z.ZodError([
      {
        code: "custom",
        input: value,
        message,
        path: [],
      },
    ]);
  }

  return new Date(value);
}

function parseOptionalDate(value: string, message: string) {
  if (!value) {
    return undefined;
  }

  return parseDate(value, message);
}

export function parsePaymentFormData(formData: FormData) {
  const invoiceIds = formData
    .getAll("invoiceIds")
    .filter((value): value is string => typeof value === "string");
  const allocations = invoiceIds.map((invoiceId) => ({
    amount: getDecimal(
      getString(formData, `allocationAmount:${invoiceId}`),
      "Allocation amount must be valid",
    ),
    invoiceId,
  }));
  const methodIds = formData
    .getAll("addedMethodIds")
    .filter((value): value is string => typeof value === "string");
  const methods = methodIds.map((clientId) => {
    const method = paymentMethodSchema.parse(
      getString(formData, `addedMethod:${clientId}:method`),
    );
    const invoiceIdsForMethod = formData
      .getAll(`addedMethod:${clientId}:invoiceIds`)
      .filter((value): value is string => typeof value === "string");

    return {
      allocations: invoiceIdsForMethod.map((invoiceId) => ({
        amount: getDecimal(
          getString(formData, `addedMethod:${clientId}:allocation:${invoiceId}`),
          "Method allocation amount must be valid",
        ),
        invoiceId,
      })),
      amount: getDecimal(
        getString(formData, `addedMethod:${clientId}:amount`),
        "Payment method amount must be valid",
      ),
      bankReference:
        getString(formData, `addedMethod:${clientId}:bankReference`) ||
        undefined,
      cardReference:
        getString(formData, `addedMethod:${clientId}:cardReference`) ||
        undefined,
      chequeBank:
        getString(formData, `addedMethod:${clientId}:chequeBankName`) ||
        getString(formData, `addedMethod:${clientId}:chequeBank`) ||
        undefined,
      chequeDate: parseOptionalDate(
        getString(formData, `addedMethod:${clientId}:chequeDate`),
        "Cheque date must be valid",
      ),
      chequeNumber:
        getString(formData, `addedMethod:${clientId}:chequeNumber`) ||
        undefined,
      clientId,
      method,
    };
  });

  return paymentValidationSchema.parse({
    allocations,
    customerId: getString(formData, "customerId"),
    methods,
    notes: getString(formData, "notes") || undefined,
    paymentDate: parseDate(getString(formData, "paymentDate"), "Payment date is required"),
  });
}

export function getValidationErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Please check the form and try again";
  }

  return "Please check the form and try again";
}
