import Link from "next/link";
import { Prisma } from "@prisma/client";
import {
  CreditCard,
  FileText,
  Landmark,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { prisma } from "@/lib/prisma";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(value: { toString(): string }) {
  return numberFormatter.format(Number(value.toString()));
}

function formatDate(date: Date | null) {
  if (!date) return "-";

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPaymentReference(payment: { id: string; paymentDate: Date }) {
  const datePart = payment.paymentDate
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
  const idPart = payment.id.slice(-4).toUpperCase();

  return `PAY-${datePart}-${idPart}`;
}

function getReceiptSearchWhere(query: string): Prisma.PaymentWhereInput[] {
  const receiptMatch = query.match(/^PAY-(\d{8})-([A-Za-z0-9]+)$/i);

  if (!receiptMatch) {
    return [];
  }

  const [, dateValue, idSuffix] = receiptMatch;
  const year = Number(dateValue.slice(0, 4));
  const month = Number(dateValue.slice(4, 6));
  const day = Number(dateValue.slice(6, 8));
  const start = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(start.getTime())) {
    return [];
  }

  return [
    {
      id: {
        endsWith: idSuffix,
        mode: "insensitive",
      },
      paymentDate: {
        gte: start,
        lt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  ];
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
        <div className="flex size-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
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
            <span className="text-sm font-medium text-zinc-500">Open</span>
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
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Find customers, invoices, payment receipts, and cheques from one
              place.
            </p>
          </div>
          <EmptyState
            icon={Search}
            title="Search the distribution app"
            description="Enter a customer name, customer code, invoice number, payment receipt, reference, or cheque number in the navigation search box."
          />
        </div>
      </main>
    );
  }

  const paymentWhere: Prisma.PaymentWhereInput = {
    OR: [
      {
        id: {
          contains: query,
          mode: "insensitive",
        },
      },
      ...getReceiptSearchWhere(query),
      {
        parts: {
          some: {
            OR: [
              {
                bankReference: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                cardReference: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                chequeNumber: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      },
    ],
  };
  const [customers, invoices, payments, cheques] = await Promise.all([
    prisma.customer.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            code: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      orderBy: {
        name: "asc",
      },
      take: 10,
    }),
    prisma.invoice.findMany({
      where: {
        invoiceNumber: {
          contains: query,
          mode: "insensitive",
        },
      },
      include: {
        customer: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        invoiceDate: "desc",
      },
      take: 10,
    }),
    prisma.payment.findMany({
      where: paymentWhere,
      include: {
        customer: {
          select: {
            code: true,
            name: true,
          },
        },
        parts: {
          select: {
            bankReference: true,
            cardReference: true,
            chequeNumber: true,
            method: true,
          },
        },
      },
      orderBy: {
        paymentDate: "desc",
      },
      take: 10,
    }),
    prisma.paymentPart.findMany({
      where: {
        method: "CHEQUE",
        chequeNumber: {
          contains: query,
          mode: "insensitive",
        },
      },
      include: {
        payment: {
          include: {
            customer: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
  ]);
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
    href: `/invoices/${invoice.id}`,
    subtitle: `${invoice.customer.name} (${invoice.customer.code}) • ${formatDate(
      invoice.invoiceDate,
    )} • Rs. ${formatAmount(invoice.amount)}`,
    title: invoice.invoiceNumber,
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
      href: `/payments/${payment.id}`,
      subtitle: [
        `${payment.customer.name} (${payment.customer.code})`,
        formatDate(payment.paymentDate),
        `Rs. ${formatAmount(payment.amount)}`,
        references[0] ?? "",
      ]
        .filter(Boolean)
        .join(" • "),
      title: formatPaymentReference(payment),
      type: "Payment",
    };
  });
  const chequeResults = cheques.map((cheque) => ({
    href: `/cheques/${cheque.id}`,
    subtitle: [
      cheque.chequeBank ?? "Bank not set",
      cheque.payment.customer.name,
      formatDate(cheque.chequeDate),
      `Rs. ${formatAmount(cheque.amount)}`,
    ].join(" • "),
    title: cheque.chequeNumber ?? "Cheque without number",
    type: "Cheque",
  }));
  const hasResults =
    customerResults.length +
      invoiceResults.length +
      paymentResults.length +
      chequeResults.length >
    0;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Results for <span className="font-medium text-zinc-950">{query}</span>
          </p>
        </div>

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
      </div>
    </main>
  );
}
