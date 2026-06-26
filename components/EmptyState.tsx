import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  actionHref,
  actionLabel,
  description,
  icon: Icon,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/90 p-8 text-center shadow-sm shadow-zinc-950/[0.03]">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-medium tracking-tight text-zinc-950">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm shadow-zinc-950/10 transition-colors hover:bg-zinc-800"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
