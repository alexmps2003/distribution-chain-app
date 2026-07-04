import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatsGridProps = {
  children: ReactNode;
  className?: string;
};

export default function StatsGrid({ children, className }: StatsGridProps) {
  return (
    <section className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </section>
  );
}
