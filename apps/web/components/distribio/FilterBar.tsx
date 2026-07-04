import type { ReactNode } from "react";

export default function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4">
      {children}
    </div>
  );
}
