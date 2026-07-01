import type { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string | number;
  footer?: ReactNode;
};

export default function StatCard({ title, value, footer }: StatCardProps) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase text-zinc-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
        {value}
      </p>
      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  );
}
