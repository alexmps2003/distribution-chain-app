"use client";

import {
  type ActiveElement,
  ArcElement,
  BarElement,
  CategoryScale,
  type ChartEvent,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  Tooltip,
);

type CustomerOutstandingChartRow = {
  customer: string;
  customerId: string;
  invoiceCount: number;
  outstanding: number;
  overdueOutstanding: number;
};

type InvoiceStatusChartData = {
  paid: number;
  partiallyPaid: number;
  unpaid: number;
};

type MonthlyCollectionChartRow = {
  amount: number;
  month: string;
  monthKey: string;
  receiptCount: number;
};

const calmPalette = [
  "rgba(59, 130, 246, 0.84)",
  "rgba(16, 185, 129, 0.84)",
  "rgba(249, 115, 22, 0.84)",
  "rgba(139, 92, 246, 0.84)",
  "rgba(6, 182, 212, 0.84)",
  "rgba(244, 63, 94, 0.84)",
  "rgba(99, 102, 241, 0.84)",
  "rgba(132, 204, 22, 0.84)",
  "rgba(245, 158, 11, 0.84)",
  "rgba(100, 116, 139, 0.84)",
];

const outstandingLimitOptions = [
  { label: "Top 10", value: "10" },
  { label: "Top 20", value: "20" },
  { label: "Top 50", value: "50" },
  { label: "All", value: "all" },
];

const outstandingMinOptions = [
  { label: "All", value: "0" },
  { label: "10,000+", value: "10000" },
  { label: "25,000+", value: "25000" },
  { label: "50,000+", value: "50000" },
  { label: "100,000+", value: "100000" },
];

const outstandingStatusOptions = [
  { label: "All", value: "all" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

const invoiceStatusRangeOptions = [
  { label: "This Month", value: "thisMonth" },
  { label: "Last Month", value: "lastMonth" },
  { label: "Last 3 Months", value: "last3Months" },
  { label: "Last 6 Months", value: "last6Months" },
  { label: "This Year", value: "thisYear" },
  { label: "All Time", value: "allTime" },
];

const collectionsRangeOptions = [
  { label: "Last 3 Months", value: "last3Months" },
  { label: "Last 6 Months", value: "last6Months" },
  { label: "This Year", value: "thisYear" },
  { label: "Last Year", value: "lastYear" },
  { label: "All Time", value: "allTime" },
];

function EmptyChartCard({
  action,
  message,
  title,
}: {
  action?: React.ReactNode;
  message: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-base font-medium tracking-tight text-zinc-950">
          {title}
        </h3>
        {action}
      </div>
      <div className="mt-4 flex h-[300px] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center text-sm text-zinc-600">
        {message}
      </div>
    </section>
  );
}

function ChartCard({
  action,
  children,
  description,
  footer,
  heightClassName = "h-[300px]",
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description: string;
  footer?: React.ReactNode;
  heightClassName?: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-medium tracking-tight text-zinc-950">
            {title}
          </h3>
          <p className="mt-1 text-sm leading-5 text-zinc-600">{description}</p>
        </div>
        {action}
      </div>
      <div className={`mt-4 ${heightClassName}`}>{children}</div>
      {footer}
    </section>
  );
}

function formatChartValue(value: number | null) {
  return (value ?? 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatCurrency(value: number | null) {
  return `Rs. ${formatChartValue(value)}`;
}

function setChartCursor(event: ChartEvent, elements: ActiveElement[]) {
  const target = event.native?.target;

  if (target instanceof HTMLElement) {
    target.style.cursor = elements.length > 0 ? "pointer" : "default";
  }
}

function ChartFilterSelect({
  label,
  options,
  paramName,
  value,
}: {
  label: string;
  options: { label: string; value: string }[];
  paramName: string;
  value: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="flex w-fit items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
      {label}
      <select
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set(paramName, event.target.value);
          const query = params.toString();

          router.replace(query ? `${pathname}?${query}` : pathname, {
            scroll: false,
          });
        }}
        className="h-9 rounded-full border border-zinc-300 bg-white px-3 text-xs font-medium normal-case tracking-normal text-zinc-700 outline-none transition-colors hover:bg-zinc-50 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChartFilterGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      {children}
    </div>
  );
}

export default function DashboardCharts({
  customerOutstanding,
  customerOutstandingAreaOptions,
  customerOutstandingRouteOptions,
  invoiceStatus,
  monthlyCollections,
  selectedCollectionsRange,
  selectedInvoiceStatusRange,
  selectedOutstandingArea,
  selectedOutstandingLimit,
  selectedOutstandingMin,
  selectedOutstandingRoute,
  selectedOutstandingStatus,
}: {
  customerOutstanding: CustomerOutstandingChartRow[];
  customerOutstandingAreaOptions: string[];
  customerOutstandingRouteOptions: string[];
  invoiceStatus: InvoiceStatusChartData;
  monthlyCollections: MonthlyCollectionChartRow[];
  selectedCollectionsRange: string;
  selectedInvoiceStatusRange: string;
  selectedOutstandingArea: string;
  selectedOutstandingLimit: number | "all";
  selectedOutstandingMin: number;
  selectedOutstandingRoute: string;
  selectedOutstandingStatus: string;
}) {
  const router = useRouter();
  const hasCustomerOutstanding = customerOutstanding.some(
    (row) => row.outstanding > 0,
  );
  const hasInvoiceStatus =
    invoiceStatus.paid + invoiceStatus.partiallyPaid + invoiceStatus.unpaid > 0;
  const hasMonthlyCollections = monthlyCollections.some(
    (row) => row.amount > 0,
  );
  const outstandingFilterControls = (
    <ChartFilterGroup>
      <ChartFilterSelect
        label="Show"
        options={outstandingLimitOptions}
        paramName="outstandingLimit"
        value={String(selectedOutstandingLimit)}
      />
      <ChartFilterSelect
        label="Min"
        options={outstandingMinOptions}
        paramName="outstandingMin"
        value={String(selectedOutstandingMin)}
      />
      <ChartFilterSelect
        label="Route"
        options={[
          { label: "All Routes", value: "all" },
          ...customerOutstandingRouteOptions.map((route) => ({
            label: route,
            value: route,
          })),
        ]}
        paramName="outstandingRoute"
        value={selectedOutstandingRoute}
      />
      <ChartFilterSelect
        label="Area"
        options={[
          { label: "All Areas", value: "all" },
          ...customerOutstandingAreaOptions.map((area) => ({
            label: area,
            value: area,
          })),
        ]}
        paramName="outstandingArea"
        value={selectedOutstandingArea}
      />
      <ChartFilterSelect
        label="Status"
        options={outstandingStatusOptions}
        paramName="outstandingStatus"
        value={selectedOutstandingStatus}
      />
    </ChartFilterGroup>
  );
  const outstandingLimitLabel =
    selectedOutstandingLimit === "all"
      ? "all matching customers"
      : `top ${selectedOutstandingLimit} customers`;
  const invoiceStatusItems = [
    {
      count: invoiceStatus.paid,
      href: "/invoices?status=paid",
      label: "Paid",
    },
    {
      count: invoiceStatus.partiallyPaid,
      href: "/invoices?status=partial",
      label: "Partially Paid",
    },
    {
      count: invoiceStatus.unpaid,
      href: "/invoices?status=unpaid",
      label: "Unpaid",
    },
  ];
  const invoiceStatusTotal = invoiceStatusItems.reduce(
    (total, item) => total + item.count,
    0,
  );

  return (
    <section>
      <div>
        <h2 className="text-lg font-medium tracking-tight">
          Business Insights
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Live financial snapshots from invoices, payments, and customer
          balances.
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {hasCustomerOutstanding ? (
          <ChartCard
            title="Outstanding by Customer"
            description={`Showing ${outstandingLimitLabel} by outstanding balance.`}
            heightClassName="h-[300px]"
            action={outstandingFilterControls}
          >
            <Bar
              data={{
                labels: customerOutstanding.map((row) => row.customer),
                datasets: [
                  {
                    data: customerOutstanding.map((row) => row.outstanding),
                    backgroundColor: customerOutstanding.map(
                      (_, index) => calmPalette[index % calmPalette.length],
                    ),
                    borderRadius: 7,
                    borderSkipped: false,
                    barPercentage: 0.7,
                    categoryPercentage: 0.6,
                    label: "Outstanding",
                    maxBarThickness: 32,
                  },
                ],
              }}
              options={{
                indexAxis: "y",
                maintainAspectRatio: false,
                onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
                  const index = elements[0]?.index;
                  const row =
                    typeof index === "number"
                      ? customerOutstanding[index]
                      : undefined;

                  if (row) {
                    router.push(`/customers/${row.customerId}`);
                  }
                },
                onHover: setChartCursor,
                plugins: {
                  legend: {
                    display: false,
                  },
                  tooltip: {
                    callbacks: {
                      afterLabel: (context) => {
                        const row = customerOutstanding[context.dataIndex];

                        if (!row) {
                          return [];
                        }

                        return [
                          formatCurrency(row.outstanding),
                          `Invoices: ${row.invoiceCount}`,
                          `Overdue: ${formatCurrency(row.overdueOutstanding)}`,
                        ];
                      },
                      label: () => "Outstanding",
                    },
                  },
                },
                scales: {
                  x: {
                    border: { display: false },
                    grid: { color: "rgba(212, 212, 216, 0.45)" },
                    ticks: {
                      color: "#71717a",
                      callback: (value) => Number(value).toLocaleString("en-US"),
                      font: { size: 11 },
                    },
                  },
                  y: {
                    border: { display: false },
                    grid: { display: false },
                    ticks: { color: "#52525b", font: { size: 11 } },
                  },
                },
              }}
            />
          </ChartCard>
        ) : (
          <EmptyChartCard
            title="Outstanding by Customer"
            message="No outstanding customer balances to chart."
            action={outstandingFilterControls}
          />
        )}

        {hasInvoiceStatus ? (
          <ChartCard
            title="Invoice Status"
            description="Calculated from active payment allocations."
            action={
              <ChartFilterSelect
                label="Range"
                options={invoiceStatusRangeOptions}
                paramName="invoiceStatusRange"
                value={selectedInvoiceStatusRange}
              />
            }
            footer={
              <div className="mt-4 grid gap-2 rounded-xl bg-zinc-50/80 p-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-zinc-500">Paid</p>
                  <p className="mt-1 font-medium text-emerald-700">
                    {invoiceStatus.paid}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500">
                    Partially Paid
                  </p>
                  <p className="mt-1 font-medium text-amber-700">
                    {invoiceStatus.partiallyPaid}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500">Unpaid</p>
                  <p className="mt-1 font-medium text-rose-700">
                    {invoiceStatus.unpaid}
                  </p>
                </div>
              </div>
            }
            heightClassName="h-[280px]"
          >
            <Doughnut
              data={{
                labels: invoiceStatusItems.map((item) => item.label),
                datasets: [
                  {
                    data: invoiceStatusItems.map((item) => item.count),
                    backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
                    borderColor: "#ffffff",
                    borderWidth: 4,
                    hoverOffset: 6,
                  },
                ],
              }}
              options={{
                cutout: "68%",
                maintainAspectRatio: false,
                onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
                  const index = elements[0]?.index;
                  const item =
                    typeof index === "number"
                      ? invoiceStatusItems[index]
                      : undefined;

                  if (item) {
                    router.push(item.href);
                  }
                },
                onHover: setChartCursor,
                plugins: {
                  legend: {
                    labels: {
                      boxHeight: 10,
                      boxWidth: 10,
                      color: "#52525b",
                      font: { size: 12 },
                      usePointStyle: true,
                    },
                    position: "bottom",
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const item = invoiceStatusItems[context.dataIndex];
                        const count = item?.count ?? 0;
                        const percentage =
                          invoiceStatusTotal > 0
                            ? Math.round((count / invoiceStatusTotal) * 100)
                            : 0;

                        return `${context.label}: ${count} invoices (${percentage}%)`;
                      },
                    },
                  },
                },
              }}
            />
          </ChartCard>
        ) : (
          <EmptyChartCard
            title="Invoice Status"
            message="No invoice status data available yet."
            action={
              <ChartFilterSelect
                label="Range"
                options={invoiceStatusRangeOptions}
                paramName="invoiceStatusRange"
                value={selectedInvoiceStatusRange}
              />
            }
          />
        )}

        <div className="lg:col-span-2">
          {hasMonthlyCollections ? (
            <ChartCard
              title="Monthly Collections"
              description="Active payment allocations grouped by payment date."
              heightClassName="h-[320px]"
              action={
                <ChartFilterSelect
                  label="Range"
                  options={collectionsRangeOptions}
                  paramName="collectionsRange"
                  value={selectedCollectionsRange}
                />
              }
            >
              <Bar
                data={{
                  labels: monthlyCollections.map((row) => row.month),
                  datasets: [
                    {
                      data: monthlyCollections.map((row) => row.amount),
                      backgroundColor: monthlyCollections.map(
                        (_, index) => calmPalette[index % calmPalette.length],
                      ),
                      borderRadius: 8,
                      borderSkipped: false,
                      barPercentage: 0.75,
                      categoryPercentage: 0.65,
                      label: "Collections",
                      maxBarThickness: 48,
                    },
                  ],
                }}
                options={{
                  maintainAspectRatio: false,
                  onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
                    const index = elements[0]?.index;
                    const row =
                      typeof index === "number"
                        ? monthlyCollections[index]
                        : undefined;

                    if (row) {
                      router.push(`/payments?month=${row.monthKey}`);
                    }
                  },
                  onHover: setChartCursor,
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      callbacks: {
                        afterLabel: (context) => {
                          const row = monthlyCollections[context.dataIndex];

                          if (!row) {
                            return [];
                          }

                          return [
                            formatCurrency(row.amount),
                            `Receipts: ${row.receiptCount}`,
                          ];
                        },
                        label: () => "Collections",
                      },
                    },
                  },
                  scales: {
                    x: {
                      border: { display: false },
                      grid: { display: false },
                      ticks: {
                        color: "#52525b",
                        font: { size: 11 },
                        maxRotation: 0,
                        minRotation: 0,
                      },
                    },
                    y: {
                      border: { display: false },
                      grid: { color: "rgba(212, 212, 216, 0.45)" },
                      ticks: {
                        color: "#71717a",
                        callback: (value) => Number(value).toLocaleString("en-US"),
                        font: { size: 11 },
                      },
                    },
                  },
                }}
              />
            </ChartCard>
          ) : (
            <EmptyChartCard
              title="Monthly Collections"
              message="No payment collections recorded yet."
              action={
                <ChartFilterSelect
                  label="Range"
                  options={collectionsRangeOptions}
                  paramName="collectionsRange"
                  value={selectedCollectionsRange}
                />
              }
            />
          )}
        </div>
      </div>
    </section>
  );
}
