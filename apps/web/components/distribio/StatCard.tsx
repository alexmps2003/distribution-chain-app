import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  footer?: ReactNode;
  className?: string;
  footerClassName?: string;
  href?: string;
  titleClassName?: string;
  valueClassName?: string;
};

export default function StatCard({
  title,
  value,
  footer,
  className,
  footerClassName,
  href,
  titleClassName,
  valueClassName,
}: StatCardProps) {
  const cardClassName = cn(
    "relative overflow-hidden rounded-md border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/[0.03]",
    className,
  );
  const content = (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-[#0f77a8]/70"
      />
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500",
          titleClassName,
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight text-zinc-950",
          valueClassName,
        )}
      >
        {value}
      </p>
      {footer ? <div className={cn("mt-2", footerClassName)}>{footer}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {content}
      </Link>
    );
  }

  return (
    <div className={cardClassName}>
      {content}
    </div>
  );
}
