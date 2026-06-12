"use client";

const confirmationMessage =
  "Are you sure you want to reverse this cheque? This will remove its allocations from invoice paid amounts and recalculate outstanding balances.";

export default function ReverseChequeButton() {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmationMessage)) {
          event.preventDefault();
        }
      }}
      className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
    >
      Reverse Cheque
    </button>
  );
}
