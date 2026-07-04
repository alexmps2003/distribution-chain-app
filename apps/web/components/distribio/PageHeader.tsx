import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  subtitleClassName?: string;
  titleClassName?: string;
};

export default function PageHeader({
  title,
  subtitle,
  actions,
  className,
  eyebrow,
  subtitleClassName,
  titleClassName,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {subtitle || eyebrow ? (
        <div>
          {eyebrow ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#0f77a8]">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              "text-3xl font-semibold tracking-tight",
              titleClassName,
            )}
          >
            {title}
          </h1>
          <p className={cn("mt-1 text-sm text-zinc-600", subtitleClassName)}>
            {subtitle}
          </p>
        </div>
      ) : (
        <h1
          className={cn(
            "text-3xl font-semibold tracking-tight",
            titleClassName,
          )}
        >
          {title}
        </h1>
      )}
      {actions ? actions : null}
    </div>
  );
}
