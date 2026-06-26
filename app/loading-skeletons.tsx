import { Skeleton } from "@/components/ui/skeleton";

function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Skeleton className="h-9 w-72 bg-zinc-200" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full bg-zinc-200" />
      </div>
      {action ? <Skeleton className="h-10 w-36 bg-zinc-200" /> : null}
    </div>
  );
}

function SummaryCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03]"
        >
          <Skeleton className="h-3 w-28 bg-zinc-200" />
          <Skeleton className="mt-3 h-8 w-32 bg-zinc-200" />
        </div>
      ))}
    </section>
  );
}

function FilterSkeleton() {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm shadow-zinc-950/[0.03]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Skeleton className="h-10 bg-zinc-200" />
        <Skeleton className="h-10 bg-zinc-200" />
        <Skeleton className="h-10 bg-zinc-200" />
        <Skeleton className="h-10 bg-zinc-200" />
        <Skeleton className="h-10 bg-zinc-200" />
      </div>
    </section>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/90 shadow-sm shadow-zinc-950/[0.03]">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-3 bg-zinc-200" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-zinc-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-4 px-4 py-4">
            {Array.from({ length: 5 }).map((_, columnIndex) => (
              <Skeleton key={columnIndex} className="h-4 bg-zinc-200" />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailBlocksSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03]">
        <Skeleton className="h-5 w-40 bg-zinc-200" />
        <div className="mt-5 grid gap-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-28 bg-zinc-200" />
              <Skeleton className="h-4 w-40 bg-zinc-200" />
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03]">
        <Skeleton className="h-5 w-40 bg-zinc-200" />
        <div className="mt-5 space-y-3">
          <Skeleton className="h-24 bg-zinc-200" />
          <Skeleton className="h-24 bg-zinc-200" />
        </div>
      </section>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-9">
        <HeaderSkeleton action={false} />
        <SummaryCardsSkeleton count={6} />
        <section>
          <Skeleton className="h-6 w-44 bg-zinc-200" />
          <Skeleton className="mt-2 h-4 w-80 bg-zinc-200" />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03]">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-5 w-48 bg-zinc-200" />
                <Skeleton className="h-9 w-40 bg-zinc-200" />
              </div>
              <Skeleton className="mt-5 h-[300px] bg-zinc-200" />
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03]">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-5 w-40 bg-zinc-200" />
                <Skeleton className="h-9 w-32 bg-zinc-200" />
              </div>
              <Skeleton className="mx-auto mt-5 h-[280px] max-w-[280px] rounded-full bg-zinc-200" />
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm shadow-zinc-950/[0.03] lg:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-5 w-48 bg-zinc-200" />
                <Skeleton className="h-9 w-36 bg-zinc-200" />
              </div>
              <Skeleton className="mt-5 h-[320px] bg-zinc-200" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function ListPageSkeleton() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <HeaderSkeleton />
        <SummaryCardsSkeleton />
        <FilterSkeleton />
        <TableSkeleton />
      </div>
    </main>
  );
}

export function DetailPageSkeleton() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <HeaderSkeleton />
        <SummaryCardsSkeleton count={3} />
        <DetailBlocksSkeleton />
        <TableSkeleton rows={5} />
      </div>
    </main>
  );
}

export function ReportPageSkeleton() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <HeaderSkeleton action={false} />
        <SummaryCardsSkeleton />
        <FilterSkeleton />
        <TableSkeleton rows={10} />
      </div>
    </main>
  );
}
