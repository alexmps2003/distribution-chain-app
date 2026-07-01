import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: ReactNode;
  contentClassName?: string;
};

export default function PageContainer({
  children,
  contentClassName,
}: PageContainerProps) {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-col gap-8",
          contentClassName,
        )}
      >
        {children}
      </div>
    </main>
  );
}
