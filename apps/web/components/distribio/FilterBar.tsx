import type { ReactNode } from "react";

export default function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 rounded-md border border-[#0f77a8]/15 bg-white p-4 shadow-sm shadow-zinc-950/[0.03]">
      {children}
    </div>
  );
}
