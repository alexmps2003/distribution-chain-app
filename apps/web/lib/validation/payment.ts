import { z } from "zod";

const paymentMethodSchema = z.enum(["CASH", "CHEQUE", "BANK_TRANSFER", "CARD"]);

class MoneyAmount {
  constructor(readonly cents: number) {}

  toString() {
    return formatCents(this.cents);
  }
}

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function getInvalidMoneyError(value: string, message: string) {
  return new z.ZodError([
    {
      code: "custom",
      input: value,
      message,
      path: [],
    },
  ]);
}

function parseMoneyCents(value: string, message: string) {
  const text = value || "0";

  if (!/^-?(?:(?:\d+)(?:\.\d*)?|\.\d+)$/.test(text)) {
    throw getInvalidMoneyError(value, message);
  }

  const sign = text.startsWith("-") ? -1 : 1;
  const [wholePart, fractionPart = ""] = text.replace("-", "").split(".");
  const wholeCents = Number(wholePart || "0") * 100;
  const fractionCents = Number(fractionPart.padEnd(2, "0").slice(0, 2));
  const cents = wholeCents + fractionCents;

  if (!Number.isSafeInteger(cents)) {
    throw getInvalidMoneyError(value, message);
  }

  return sign * cents;
}

function formatCents(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const absoluteCents = Math.abs(cents);

  return `${sign}${Math.floor(absoluteCents / 100)}.${String(
    absoluteCents % 100,
  ).padStart(2, "0")}`;
}

function getMoneyAmount(value: string, message: string) {
  return new MoneyAmount(parseMoneyCents(value, message));
}

function sumMoneyCents(values: MoneyAmount[]) {
  return values.reduce((total, value) => total + value.cents, 0);
}

function isValidDateString(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export const paymentValidationSchema = z
  .object({
    allocations: z
      .array(
        z.object({
          amount: z.instanceof(MoneyAmount),
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
                amount: z.instanceof(MoneyAmount),
                invoiceId: z.string().min(1, "Invoice is required"),
              }),
            )
            .min(1, "Each payment method needs at least one allocation"),
          amount: z.instanceof(MoneyAmount),
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
    const paymentTotal = sumMoneyCents(
      value.methods.map((method) => method.amount),
    );
    const allocationTotal = sumMoneyCents(
      value.allocations.map((allocation) => allocation.amount),
    );

    if (paymentTotal <= 0) {
      context.addIssue({
        code: "custom",
        message: "Payment amount must be greater than zero",
        path: ["methods"],
      });
    }

    if (allocationTotal > paymentTotal) {
      context.addIssue({
        code: "custom",
        message: "Total allocated amount cannot exceed payment amount",
        path: ["allocations"],
      });
    }

    for (const allocation of value.allocations) {
      if (allocation.amount.cents <= 0) {
        context.addIssue({
          code: "custom",
          message: "Allocation amounts must be greater than zero",
          path: ["allocations"],
        });
      }
    }

    for (const [index, method] of value.methods.entries()) {
      const methodAllocationTotal = sumMoneyCents(
        method.allocations.map((allocation) => allocation.amount),
      );

      if (method.amount.cents <= 0) {
        context.addIssue({
          code: "custom",
          message: "Payment method amount must be greater than zero",
          path: ["methods", index, "amount"],
        });
      }

      if (method.amount.cents !== methodAllocationTotal) {
        context.addIssue({
          code: "custom",
          message: "Each method amount must equal its method allocations",
          path: ["methods", index, "allocations"],
        });
      }

      for (const allocation of method.allocations) {
        if (allocation.amount.cents <= 0) {
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
    amount: getMoneyAmount(
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
        amount: getMoneyAmount(
          getString(formData, `addedMethod:${clientId}:allocation:${invoiceId}`),
          "Method allocation amount must be valid",
        ),
        invoiceId,
      })),
      amount: getMoneyAmount(
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
    paymentDate: parseDate(
      getString(formData, "paymentDate"),
      "Payment date is required",
    ),
  });
}

export function getValidationErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Please check the form and try again";
  }

  return "Please check the form and try again";
}
