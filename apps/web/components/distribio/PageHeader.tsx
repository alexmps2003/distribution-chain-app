import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  metadata?: ReactNode;
  metadataClassName?: string;
  subtitleClassName?: string;
  titleClassName?: string;
};

export default function PageHeader({
  title,
  subtitle,
  actions,
  className,
  eyebrow,
  metadata,
  metadataClassName,
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
      {subtitle || eyebrow || metadata ? (
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
          {subtitle ? (
            <p className={cn("mt-1 text-sm text-zinc-600", subtitleClassName)}>
              {subtitle}
            </p>
          ) : null}
          {metadata ? (
            <div
              className={cn(
                "mt-2 text-xs font-medium text-zinc-500",
                metadataClassName,
              )}
            >
              {metadata}
            </div>
          ) : null}
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
