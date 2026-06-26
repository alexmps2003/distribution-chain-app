"use client";

export default function PrintStatementButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm shadow-zinc-950/10 transition-colors hover:bg-zinc-800"
    >
      Print Statement
    </button>
  );
}
