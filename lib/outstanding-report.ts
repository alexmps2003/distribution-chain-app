import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OutstandingInvoiceRow = {
  amount: Prisma.Decimal;
  displayStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  dueDate: Date | null;
  id: string;
  invoiceDate: Date;
  invoiceNumber: string;
  outstandingAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
};

export type OutstandingCustomerRow = {
  area: string | null;
  code: string;
  id: string;
  name: string;
  oldestDueDate: Date | null;
  outstandingInvoices: OutstandingInvoiceRow[];
  routeName: string | null;
  totalOutstanding: Prisma.Decimal;
};

export type OutstandingReportCustomer = {
  code: string;
  id: string;
  name: string;
};

export function sumDecimals(values: Prisma.Decimal[]) {
  return values.reduce(
    (total, value) => total.plus(value),
    new Prisma.Decimal(0),
  );
}

function getActivePaidAmount(payments: {
  amount: Prisma.Decimal;
  paymentPart: { status: string } | null;
}[]) {
  return sumDecimals(
    payments
      .filter((allocation) => {
        return (
          allocation.paymentPart === null ||
          allocation.paymentPart.status === "ACTIVE"
        );
      })
      .map((allocation) => allocation.amount),
  );
}

function getDisplayStatus(
  paidAmount: Prisma.Decimal,
  outstandingAmount: Prisma.Decimal,
): OutstandingInvoiceRow["displayStatus"] {
  if (outstandingAmount.lte(0)) {
    return "PAID";
  }

  if (paidAmount.gt(0)) {
    return "PARTIALLY_PAID";
  }

  return "UNPAID";
}

function getOldestDueDate(invoices: { dueDate: Date | null }[]) {
  const dueDates = invoices
    .map((invoice) => invoice.dueDate)
    .filter((date): date is Date => date !== null)
    .sort((left, right) => left.getTime() - right.getTime());

  return dueDates[0] ?? null;
}

export async function getOutstandingReport() {
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      area: true,
      routeName: true,
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          invoiceDate: true,
          dueDate: true,
          payments: {
            select: {
              amount: true,
              paymentPart: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
        orderBy: {
          dueDate: "asc",
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const customerRows = customers
    .map((customer) => {
      const outstandingInvoices = customer.invoices
        .map((invoice) => {
          const paidAmount = getActivePaidAmount(invoice.payments);
          const outstandingAmount = invoice.amount.minus(paidAmount);
          const displayStatus = getDisplayStatus(paidAmount, outstandingAmount);

          return {
            ...invoice,
            displayStatus,
            outstandingAmount,
            paidAmount,
          };
        })
        .filter((invoice) => invoice.outstandingAmount.gt(0));
      const totalOutstanding = sumDecimals(
        outstandingInvoices.map((invoice) => invoice.outstandingAmount),
      );

      return {
        ...customer,
        oldestDueDate: getOldestDueDate(outstandingInvoices),
        outstandingInvoices,
        totalOutstanding,
      };
    })
    .filter((customer) => customer.totalOutstanding.gt(0));

  return {
    customerRows,
    customers: customers.map((customer) => ({
      code: customer.code,
      id: customer.id,
      name: customer.name,
    })),
  };
}
