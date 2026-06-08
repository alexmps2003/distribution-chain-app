"use client";

import { useMemo, useState } from "react";

type PaymentMethod = "cash" | "cheque" | "bankTransfer" | "card";

const paymentMethods: {
  id: PaymentMethod;
  label: string;
  amountField: string;
}[] = [
  { id: "cash", label: "Cash", amountField: "cashAmount" },
  { id: "cheque", label: "Cheque", amountField: "chequeAmount" },
  {
    id: "bankTransfer",
    label: "Bank Transfer",
    amountField: "bankTransferAmount",
  },
  { id: "card", label: "Card", amountField: "cardAmount" },
];

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseAmount(value: string) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

export default function PaymentMethodEntry() {
  const [selectedMethods, setSelectedMethods] = useState<
    Record<PaymentMethod, boolean>
  >({
    cash: false,
    cheque: false,
    bankTransfer: false,
    card: false,
  });
  const [amounts, setAmounts] = useState<Record<string, string>>({
    cashAmount: "",
    chequeAmount: "",
    bankTransferAmount: "",
    cardAmount: "",
  });

  const paymentTotal = useMemo(() => {
    return paymentMethods.reduce((total, method) => {
      if (!selectedMethods[method.id]) {
        return total;
      }

      return total + parseAmount(amounts[method.amountField] ?? "");
    }, 0);
  }, [amounts, selectedMethods]);

  function toggleMethod(method: PaymentMethod) {
    setSelectedMethods((current) => ({
      ...current,
      [method]: !current[method],
    }));
  }

  function updateAmount(name: string, value: string) {
    setAmounts((current) => ({
      ...current,
      [name]: value,
    }));
  }

  return (
    <div className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
      <h2 className="text-lg font-medium tracking-tight">Payment Methods</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {paymentMethods.map((method) => (
          <label
            key={method.id}
            className="flex cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white p-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 has-checked:border-zinc-950 has-checked:bg-zinc-50 has-checked:ring-1 has-checked:ring-zinc-950"
          >
            <input
              type="checkbox"
              name="paymentMethods"
              value={method.label}
              checked={selectedMethods[method.id]}
              onChange={() => toggleMethod(method.id)}
              className="sr-only"
            />
            {method.label}
          </label>
        ))}
      </div>

      <div className="grid gap-4">
        {selectedMethods.cash && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-zinc-950">Cash</h3>
            <Field
              label="Cash Amount"
              name="cashAmount"
              type="number"
              min="0"
              step="0.01"
              value={amounts.cashAmount}
              onChange={(value) => updateAmount("cashAmount", value)}
            />
          </div>
        )}

        {selectedMethods.cheque && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-zinc-950">
              Cheque
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cheque Number" name="chequeNumber" />
              <Field label="Bank Name" name="chequeBankName" />
              <Field label="Cheque Date" name="chequeDate" type="date" />
              <Field
                label="Cheque Amount"
                name="chequeAmount"
                type="number"
                min="0"
                step="0.01"
                value={amounts.chequeAmount}
                onChange={(value) => updateAmount("chequeAmount", value)}
              />
            </div>
          </div>
        )}

        {selectedMethods.bankTransfer && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-zinc-950">
              Bank Transfer
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Reference Number"
                name="bankTransferReferenceNumber"
              />
              <Field
                label="Transfer Amount"
                name="bankTransferAmount"
                type="number"
                min="0"
                step="0.01"
                value={amounts.bankTransferAmount}
                onChange={(value) =>
                  updateAmount("bankTransferAmount", value)
                }
              />
            </div>
          </div>
        )}

        {selectedMethods.card && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-zinc-950">Card</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reference Number" name="cardReferenceNumber" />
              <Field
                label="Card Amount"
                name="cardAmount"
                type="number"
                min="0"
                step="0.01"
                value={amounts.cardAmount}
                onChange={(value) => updateAmount("cardAmount", value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-md border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-950">
          Payment Summary
        </h3>
        <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3">
          <span className="text-sm text-zinc-600">Payment Total:</span>
          <span className="text-lg font-semibold text-zinc-950">
            {numberFormatter.format(paymentTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  min,
  step,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  min?: string;
  step?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
      {label}
      <input
        name={name}
        type={type}
        min={min}
        step={step}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      />
    </label>
  );
}
