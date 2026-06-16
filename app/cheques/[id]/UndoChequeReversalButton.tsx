"use client";

const confirmationMessage =
  "Are you sure you want to undo this cheque reversal? This cheque's allocations will once again count toward invoice payments.";

export default function UndoChequeReversalButton() {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmationMessage)) {
          event.preventDefault();
        }
      }}
      className="inline-flex h-10 w-fit items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-950 hover:bg-zinc-100"
    >
      Undo Reversal
    </button>
  );
}
