import Link from "next/link";
import {
  CreditCard,
  FileText,
  Landmark,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import PageContainer from "@/components/distribio/PageContainer";
import PageHeader from "@/components/distribio/PageHeader";
import EmptyState from "@/components/EmptyState";
import { apiGet } from "@/lib/api-client-server";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type MoneyValue = string | number;

type SearchCustomer = {
  area: string | null;
  code: string;
  id: string;
  name: string;
  routeName: string | null;
};

type SearchCustomerSummary = {
  code: string;
  id: string;
  name: string;
};

type SearchPaymentPart = {
  amount: MoneyValue;
  bankReference: string | null;
  cardReference: string | null;
  chequeBank: string | null;
  chequeDate: string | null;
  chequeNumber: string | null;
  id: string;
  method: string;
};

type SearchResponse = {
  customers: SearchCustomer[];
  invoices: {
    invoice: {
      id: string;
      invoiceDate: string;
      invoiceNumber: string;
    };
    customer: SearchCustomerSummary | null;
    amount: MoneyValue;
  }[];
  payments: {
    payment: {
      amount: MoneyValue;
      id: string;
      paymentDate: string;
    };
    receiptReference: string;
    customer: SearchCustomerSummary | null;
    parts: SearchPaymentPart[];
  }[];
  cheques: {
    cheque: SearchPaymentPart;
    payment: {
      id: string;
      paymentDate: string;
    } | null;
    customer: SearchCustomerSummary | null;
    status: string;
  }[];
};

function formatAmount(value: MoneyValue) {
  return numberFormatter.format(Number(String(value)));
}

function formatDate(date: Date | null) {
  if (!date) return "-";

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ResultSection({
  icon: Icon,
  results,
  title,
}: {
  icon: LucideIcon;
  results: {
    href: string;
    subtitle: string;
    title: string;
    type: string;
  }[];
  title: string;
}) {
  if (results.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03]">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-full bg-[#0f77a8]/10 text-[#0f77a8] ring-1 ring-[#0f77a8]/15">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-medium tracking-tight text-zinc-950">
          {title}
        </h2>
      </div>
      <div className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200/80">
        {results.map((result) => (
          <Link
            key={`${result.type}:${result.href}`}
            href={result.href}
            className="flex flex-col gap-2 bg-white px-4 py-4 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-zinc-950">{result.title}</p>
                <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600">
                  {result.type}
                </span>
              </div>
              <p className="mt-1 text-sm leading-5 text-zinc-600">
                {result.subtitle}
              </p>
            </div>
            <span className="text-sm font-medium text-[#0f77a8]">Open</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const queryValue = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = queryValue?.trim() ?? "";

  if (!query) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow="Distribio search"
          title="Search"
          subtitle="Find customers, invoices, payment receipts, and cheques from one place."
          className="block"
          subtitleClassName="mt-2 leading-6"
        />
        <EmptyState
          icon={Search}
          title="Search the distribution app"
          description="Enter a customer name, customer code, invoice number, payment receipt, reference, or cheque number in the navigation search box."
        />
      </PageContainer>
    );
  }

  const { cheques, customers, invoices, payments } =
    await apiGet<SearchResponse>(`/search?q=${encodeURIComponent(query)}`);
  const customerResults = customers.map((customer) => ({
    href: `/customers/${customer.id}`,
    subtitle: [
      `Code ${customer.code}`,
      customer.area ? `Area ${customer.area}` : "",
      customer.routeName ? `Route ${customer.routeName}` : "",
    ]
      .filter(Boolean)
      .join(" • "),
    title: customer.name,
    type: "Customer",
  }));
  const invoiceResults = invoices.map((invoice) => ({
    href: `/invoices/${invoice.invoice.id}`,
    subtitle: `${invoice.customer ? `${invoice.customer.name} (${invoice.customer.code})` : "Customer not found"} • ${formatDate(
      new Date(invoice.invoice.invoiceDate),
    )} • Rs. ${formatAmount(invoice.amount)}`,
    title: invoice.invoice.invoiceNumber,
    type: "Invoice",
  }));
  const paymentResults = payments.map((payment) => {
    const references = payment.parts
      .flatMap((part) => [
        part.chequeNumber ? `Cheque ${part.chequeNumber}` : "",
        part.bankReference ? `Bank ref ${part.bankReference}` : "",
        part.cardReference ? `Card ref ${part.cardReference}` : "",
      ])
      .filter(Boolean);

    return {
      href: `/payments/${payment.payment.id}`,
      subtitle: [
        payment.customer
          ? `${payment.customer.name} (${payment.customer.code})`
          : "Customer not found",
        formatDate(new Date(payment.payment.paymentDate)),
        `Rs. ${formatAmount(payment.payment.amount)}`,
        references[0] ?? "",
      ]
        .filter(Boolean)
        .join(" • "),
      title: payment.receiptReference,
      type: "Payment",
    };
  });
  const chequeResults = cheques.map((cheque) => ({
    href: `/cheques/${cheque.cheque.id}`,
    subtitle: [
      cheque.cheque.chequeBank ?? "Bank not set",
      cheque.customer?.name ?? "Customer not found",
      formatDate(
        cheque.cheque.chequeDate ? new Date(cheque.cheque.chequeDate) : null,
      ),
      `Rs. ${formatAmount(cheque.cheque.amount)}`,
    ].join(" • "),
    title: cheque.cheque.chequeNumber ?? "Cheque without number",
    type: "Cheque",
  }));
  const hasResults =
    customerResults.length +
      invoiceResults.length +
      paymentResults.length +
      chequeResults.length >
    0;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Distribio search"
        title="Search"
        subtitle={
          <>
            Results for{" "}
            <span className="font-medium text-zinc-950">{query}</span>
          </>
        }
        className="block"
        subtitleClassName="mt-2 leading-6"
      />

      {!hasResults ? (
        <EmptyState
          icon={Search}
          title="No results found"
          description="Try a customer name, customer code, invoice number, payment receipt, reference, or cheque number."
        />
      ) : (
        <div className="grid gap-6">
          <ResultSection
            icon={Users}
            title="Customers"
            results={customerResults}
          />
          <ResultSection
            icon={FileText}
            title="Invoices"
            results={invoiceResults}
          />
          <ResultSection
            icon={CreditCard}
            title="Payments"
            results={paymentResults}
          />
          <ResultSection
            icon={Landmark}
            title="Cheques"
            results={chequeResults}
          />
        </div>
      )}
    </PageContainer>
  );
}
