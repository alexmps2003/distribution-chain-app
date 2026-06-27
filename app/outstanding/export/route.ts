import { apiGet } from "@/lib/api-client";

type MoneyValue = string | number;

type OutstandingCustomer = {
  area: string | null;
  code: string;
  id: string;
  name: string;
  routeName: string | null;
};

type GeneralOutstandingResponse = {
  summary: {
    customerCount: number;
    totalOutstanding: MoneyValue;
    overdueInvoiceCount: number;
    highestOutstandingCustomer:
      | (OutstandingCustomer & { totalOutstanding: MoneyValue })
      | null;
  };
  customers: {
    customer: OutstandingCustomer;
    totalOutstanding: MoneyValue;
    outstandingInvoiceCount: number;
    oldestDueDate: string | null;
  }[];
};

type CustomerOutstandingResponse = {
  customer: OutstandingCustomer;
  summary: {
    totalOutstanding: MoneyValue;
    outstandingInvoiceCount: number;
    oldestDueDate: string | null;
  };
  invoices: {
    invoice: {
      amount: MoneyValue;
      dueDate: string | null;
      invoiceDate: string;
      invoiceNumber: string;
    };
    activePaidAmount: MoneyValue;
    outstanding: MoneyValue;
    displayStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  }[];
};

function formatDateForCsv(date: Date | null) {
  if (!date) return "";

  return date.toISOString().slice(0, 10);
}

function escapeCsvValue(value: string | number) {
  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function toCsv(rows: (string | number)[][]) {
  return rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\r\n");
}

function getCsvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

function getSafeFilenamePart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-") || "customer";
}

function formatAmountForCsv(value: MoneyValue) {
  return Number(String(value)).toFixed(2);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");

  if (customerId) {
    let report: CustomerOutstandingResponse;

    try {
      report = await apiGet<CustomerOutstandingResponse>(
        `/outstanding?customerId=${encodeURIComponent(customerId)}`,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("failed with 404")) {
        return new Response("Customer not found", { status: 404 });
      }

      throw error;
    }

    const csv = toCsv([
      [
        "Invoice Number",
        "Invoice Date",
        "Due Date",
        "Invoice Total",
        "Paid Amount",
        "Outstanding Amount",
        "Status",
      ],
      ...report.invoices.map(({ activePaidAmount, displayStatus, invoice, outstanding }) => [
        invoice.invoiceNumber,
        formatDateForCsv(new Date(invoice.invoiceDate)),
        formatDateForCsv(invoice.dueDate ? new Date(invoice.dueDate) : null),
        formatAmountForCsv(invoice.amount),
        formatAmountForCsv(activePaidAmount),
        formatAmountForCsv(outstanding),
        displayStatus.replace("_", " "),
      ]),
    ]);
    const filename = `outstanding-${getSafeFilenamePart(report.customer.code)}.csv`;

    return getCsvResponse(csv, filename);
  }

  const report = await apiGet<GeneralOutstandingResponse>("/outstanding");
  const csv = toCsv([
    [
      "Customer Name",
      "Customer Code",
      "Area",
      "Route",
      "Outstanding Invoice Count",
      "Total Outstanding",
      "Oldest Due Date",
    ],
    ...report.customers.map((row) => [
      row.customer.name,
      row.customer.code,
      row.customer.area ?? "",
      row.customer.routeName ?? "",
      row.outstandingInvoiceCount,
      formatAmountForCsv(row.totalOutstanding),
      formatDateForCsv(row.oldestDueDate ? new Date(row.oldestDueDate) : null),
    ]),
  ]);

  return getCsvResponse(csv, "outstanding-customers.csv");
}
