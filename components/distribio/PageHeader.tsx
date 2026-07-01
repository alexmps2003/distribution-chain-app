import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {subtitle ? (
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
        </div>
      ) : (
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      )}
      {actions ? actions : null}
    </div>
  );
}
