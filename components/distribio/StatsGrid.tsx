import type { ReactNode } from "react";

export default function StatsGrid({ children }: { children: ReactNode }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </section>
  );
}
