"use client";

import { useMemo, useState } from "react";

type PaymentMethod = "cash" | "cheque" | "bankTransfer" | "card";

type AllocationInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  amount: string;
  status: string;
};

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

function toCents(value: number) {
  return Math.round(value * 100);
}

function formatAmount(value: string | number) {
  return numberFormatter.format(
    typeof value === "number" ? value : parseAmount(value),
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PaymentMethodEntry({
  customerId,
  invoices,
}: {
  customerId?: string;
  invoices: AllocationInvoice[];
}) {
  const [selectedInvoices, setSelectedInvoices] = useState<
    Record<string, boolean>
  >({});
  const [allocationAmounts, setAllocationAmounts] = useState<
    Record<string, string>
  >({});
  const [selectedMethods, setSelectedMethods] = useState<
    Record<PaymentMethod, boolean>
  >({
    cash: false,
    cheque: false,
    bankTransfer: false,
    card: false,
  });
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({
    cashAmount: "",
    chequeAmount: "",
    bankTransferAmount: "",
    cardAmount: "",
  });

  const totalAllocated = useMemo(() => {
    return invoices.reduce((total, invoice) => {
      if (!selectedInvoices[invoice.id]) {
        return total;
      }

      return total + parseAmount(allocationAmounts[invoice.id] ?? "");
    }, 0);
  }, [allocationAmounts, invoices, selectedInvoices]);

  const paymentTotal = useMemo(() => {
    return paymentMethods.reduce((total, method) => {
      if (!selectedMethods[method.id]) {
        return total;
      }

      return total + parseAmount(paymentAmounts[method.amountField] ?? "");
    }, 0);
  }, [paymentAmounts, selectedMethods]);

  const isBalanced =
    paymentTotal > 0 &&
    totalAllocated > 0 &&
    toCents(paymentTotal) === toCents(totalAllocated);

  function toggleInvoice(invoiceId: string) {
    setSelectedInvoices((current) => {
      const nextSelected = !current[invoiceId];

      if (!nextSelected) {
        setAllocationAmounts((amounts) => ({
          ...amounts,
          [invoiceId]: "",
        }));
      }

      return {
        ...current,
        [invoiceId]: nextSelected,
      };
    });
  }

  function updateAllocationAmount(invoiceId: string, value: string) {
    setAllocationAmounts((current) => ({
      ...current,
      [invoiceId]: value,
    }));
  }

  function toggleMethod(method: PaymentMethod) {
    setSelectedMethods((current) => {
      const nextSelected = !current[method];

      if (!nextSelected) {
        const amountField = paymentMethods.find((item) => item.id === method)
          ?.amountField;

        if (amountField) {
          setPaymentAmounts((amounts) => ({
            ...amounts,
            [amountField]: "",
          }));
        }
      }

      return {
        ...current,
        [method]: nextSelected,
      };
    });
  }

  function updatePaymentAmount(name: string, value: string) {
    setPaymentAmounts((current) => ({
      ...current,
      [name]: value,
    }));
  }

  return (
    <>
      <div className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
        <h2 className="text-lg font-medium tracking-tight">
          Invoice Allocation
        </h2>
        {!customerId ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
            Select a customer to view outstanding invoices.
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
            No outstanding invoices.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                  <tr>
                    <th scope="col" className="w-10 px-4 py-3">
                      <span className="sr-only">Select</span>
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Invoice
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Due Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Amount
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Allocation Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {invoices.map((invoice) => {
                    const isSelected = Boolean(selectedInvoices[invoice.id]);

                    return (
                      <tr key={invoice.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            name="invoiceIds"
                            value={invoice.id}
                            checked={isSelected}
                            onChange={() => toggleInvoice(invoice.id)}
                            className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {formatDate(invoice.invoiceDate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {formatDate(invoice.dueDate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(invoice.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            {invoice.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <input
                            name="allocationAmounts"
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!isSelected}
                            value={allocationAmounts[invoice.id] ?? ""}
                            onChange={(event) =>
                              updateAllocationAmount(
                                invoice.id,
                                event.target.value,
                              )
                            }
                            className="h-9 w-36 rounded-md border border-zinc-300 bg-white px-3 text-right text-sm text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-950">
            Allocation Summary
          </h3>
          <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3">
            <span className="text-sm text-zinc-600">Total Allocated:</span>
            <span className="text-lg font-semibold text-zinc-950">
              {formatAmount(totalAllocated)}
            </span>
          </div>
        </div>
      </div>

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
              <h3 className="mb-4 text-sm font-semibold text-zinc-950">
                Cash
              </h3>
              <Field
                label="Cash Amount"
                name="cashAmount"
                type="number"
                min="0"
                step="0.01"
                value={paymentAmounts.cashAmount}
                onChange={(value) => updatePaymentAmount("cashAmount", value)}
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
                  value={paymentAmounts.chequeAmount}
                  onChange={(value) =>
                    updatePaymentAmount("chequeAmount", value)
                  }
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
                  value={paymentAmounts.bankTransferAmount}
                  onChange={(value) =>
                    updatePaymentAmount("bankTransferAmount", value)
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
                  value={paymentAmounts.cardAmount}
                  onChange={(value) => updatePaymentAmount("cardAmount", value)}
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
              {formatAmount(paymentTotal)}
            </span>
          </div>
          <div className="mt-3 border-t border-zinc-200 pt-3">
            <span
              className={
                isBalanced
                  ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                  : "inline-flex rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700"
              }
            >
              {isBalanced
                ? "Balanced"
                : "Totals must match before saving"}
            </span>
          </div>
        </div>
      </div>
    </>
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
