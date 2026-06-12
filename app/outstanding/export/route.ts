import { getOutstandingReport } from "@/lib/outstanding-report";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const { customerRows, customers } = await getOutstandingReport();

  if (customerId) {
    const customerRow = customerRows.find((row) => row.id === customerId);
    const customer = customerRow ?? customers.find((row) => row.id === customerId);

    if (!customer) {
      return new Response("Customer not found", { status: 404 });
    }

    const outstandingInvoices = customerRow?.outstandingInvoices ?? [];
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
      ...outstandingInvoices.map((invoice) => [
        invoice.invoiceNumber,
        formatDateForCsv(invoice.invoiceDate),
        formatDateForCsv(invoice.dueDate),
        invoice.amount.toFixed(2),
        invoice.paidAmount.toFixed(2),
        invoice.outstandingAmount.toFixed(2),
        invoice.displayStatus.replace("_", " "),
      ]),
    ]);
    const filename = `outstanding-${getSafeFilenamePart(customer.code)}.csv`;

    return getCsvResponse(csv, filename);
  }

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
    ...customerRows.map((customer) => [
      customer.name,
      customer.code,
      customer.area ?? "",
      customer.routeName ?? "",
      customer.outstandingInvoices.length,
      customer.totalOutstanding.toFixed(2),
      formatDateForCsv(customer.oldestDueDate),
    ]),
  ]);

  return getCsvResponse(csv, "outstanding-customers.csv");
}
