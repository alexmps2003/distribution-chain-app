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
    "rounded-md border border-zinc-200 bg-white p-5",
    className,
  );
  const content = (
    <>
      <p
        className={cn(
          "text-xs font-semibold uppercase text-zinc-500",
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
