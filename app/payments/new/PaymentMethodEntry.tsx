"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BANK_OPTIONS } from "@/lib/bank-options";

export type PaymentMethod = "CASH" | "CHEQUE" | "BANK_TRANSFER" | "CARD";

type AllocationInvoice = {
  id: string;
  invoiceNumber: string;
  dueDate: string | null;
  invoiceTotal: string;
  outstandingAmount: string;
  status: string;
};

type AddedMethod = {
  id: string;
  method: PaymentMethod;
  amount: string;
  details: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeDate?: string;
  bankReference?: string;
  cardReference?: string;
  allocations: {
    invoiceId: string;
    invoiceNumber: string;
    amount: string;
  }[];
};

export type InitialPaymentMethodEntryState = {
  addedMethods?: AddedMethod[];
  allocationAmounts?: Record<string, string>;
  selectedInvoices?: Record<string, boolean>;
};

const paymentMethods: { id: PaymentMethod; label: string }[] = [
  { id: "CASH", label: "Cash" },
  { id: "CHEQUE", label: "Cheque" },
  { id: "BANK_TRANSFER", label: "Bank Transfer" },
  { id: "CARD", label: "Card" },
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

function getMethodLabel(method: PaymentMethod) {
  return paymentMethods.find((item) => item.id === method)?.label ?? method;
}

export default function PaymentMethodEntry({
  canSavePayment = true,
  customerId,
  initialState,
  invoices,
  saveAction,
}: {
  canSavePayment?: boolean;
  customerId?: string;
  initialState?: InitialPaymentMethodEntryState;
  invoices: AllocationInvoice[];
  saveAction: (formData: FormData) => void | Promise<void>;
}) {
  const [selectedInvoices, setSelectedInvoices] = useState<
    Record<string, boolean>
  >(initialState?.selectedInvoices ?? {});
  const [allocationAmounts, setAllocationAmounts] = useState<
    Record<string, string>
  >(initialState?.allocationAmounts ?? {});
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | "">("");
  const [methodAmount, setMethodAmount] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [methodAllocationAmounts, setMethodAllocationAmounts] = useState<
    Record<string, string>
  >({});
  const [addedMethods, setAddedMethods] = useState<AddedMethod[]>(
    initialState?.addedMethods ?? [],
  );
  const [methodMessage, setMethodMessage] = useState("");

  const selectedAllocationInvoices = useMemo(() => {
    return invoices.filter((invoice) => selectedInvoices[invoice.id]);
  }, [invoices, selectedInvoices]);

  const totalAllocated = useMemo(() => {
    return invoices.reduce((total, invoice) => {
      if (!selectedInvoices[invoice.id]) {
        return total;
      }

      return total + parseAmount(allocationAmounts[invoice.id] ?? "");
    }, 0);
  }, [allocationAmounts, invoices, selectedInvoices]);

  const methodAllocationTotal = useMemo(() => {
    return selectedAllocationInvoices.reduce((total, invoice) => {
      return total + parseAmount(methodAllocationAmounts[invoice.id] ?? "");
    }, 0);
  }, [methodAllocationAmounts, selectedAllocationInvoices]);

  const addedAllocationByInvoice = useMemo(() => {
    return addedMethods.reduce<Record<string, number>>((totals, method) => {
      for (const allocation of method.allocations) {
        totals[allocation.invoiceId] =
          (totals[allocation.invoiceId] ?? 0) + parseAmount(allocation.amount);
      }

      return totals;
    }, {});
  }, [addedMethods]);

  const remainingAllocationByInvoice = useMemo(() => {
    return invoices.reduce<Record<string, number>>((remaining, invoice) => {
      const overallAllocation = selectedInvoices[invoice.id]
        ? parseAmount(allocationAmounts[invoice.id] ?? "")
        : 0;
      const alreadyAdded = addedAllocationByInvoice[invoice.id] ?? 0;

      remaining[invoice.id] = Math.max(overallAllocation - alreadyAdded, 0);

      return remaining;
    }, {});
  }, [
    addedAllocationByInvoice,
    allocationAmounts,
    invoices,
    selectedInvoices,
  ]);

  const addedMethodsTotal = useMemo(() => {
    return addedMethods.reduce((total, method) => {
      return total + parseAmount(method.amount);
    }, 0);
  }, [addedMethods]);

  const hasMethodAllocationOverRemaining = selectedAllocationInvoices.some(
    (invoice) => {
      return (
        toCents(parseAmount(methodAllocationAmounts[invoice.id] ?? "")) >
        toCents(remainingAllocationByInvoice[invoice.id] ?? 0)
      );
    },
  );
  const methodAmountMatchesAllocations =
    toCents(parseAmount(methodAmount)) === toCents(methodAllocationTotal);
  const canAddMethod =
    selectedMethod !== "" &&
    parseAmount(methodAmount) > 0 &&
    (selectedMethod !== "CHEQUE" || chequeBank !== "") &&
    selectedAllocationInvoices.length > 0 &&
    methodAmountMatchesAllocations &&
    !hasMethodAllocationOverRemaining;
  const hasFinalPerInvoiceMismatch = invoices.some((invoice) => {
    if (!selectedInvoices[invoice.id]) {
      return false;
    }

    return (
      toCents(addedAllocationByInvoice[invoice.id] ?? 0) !==
      toCents(parseAmount(allocationAmounts[invoice.id] ?? ""))
    );
  });
  const finalTotalsMatch =
    totalAllocated > 0 &&
    addedMethods.length > 0 &&
    toCents(totalAllocated) === toCents(addedMethodsTotal) &&
    !hasFinalPerInvoiceMismatch;

  function toggleInvoice(invoiceId: string) {
    setSelectedInvoices((current) => {
      const nextSelected = !current[invoiceId];

      if (!nextSelected) {
        setAllocationAmounts((amounts) => ({
          ...amounts,
          [invoiceId]: "",
        }));
        setMethodAllocationAmounts((amounts) => ({
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
    const invoice = invoices.find((item) => item.id === invoiceId);
    const outstandingAmount = invoice
      ? parseAmount(invoice.outstandingAmount)
      : 0;
    const requestedAmount = parseAmount(value);
    const nextValue =
      value !== "" && requestedAmount > outstandingAmount
        ? outstandingAmount.toFixed(2)
        : value;

    setAllocationAmounts((current) => ({
      ...current,
      [invoiceId]: nextValue,
    }));
  }

  function updateMethodAllocationAmount(invoiceId: string, value: string) {
    const remainingAllocation = remainingAllocationByInvoice[invoiceId] ?? 0;
    const requestedAmount = parseAmount(value);
    const nextValue =
      value !== "" && requestedAmount > remainingAllocation
        ? remainingAllocation.toFixed(2)
        : value;

    setMethodAllocationAmounts((current) => ({
      ...current,
      [invoiceId]: nextValue,
    }));
  }

  function addMethod() {
    const amount = parseAmount(methodAmount);

    if (!selectedMethod) {
      setMethodMessage("Select a payment method before adding.");
      return;
    }

    if (amount <= 0) {
      setMethodMessage("Method amount must be greater than 0.");
      return;
    }

    if (selectedAllocationInvoices.length === 0) {
      setMethodMessage("Select at least one invoice before adding a method.");
      return;
    }

    if (selectedMethod === "CHEQUE" && !chequeBank) {
      setMethodMessage("Select a bank before adding a cheque payment.");
      return;
    }

    if (toCents(amount) !== toCents(methodAllocationTotal)) {
      setMethodMessage("Method allocations must equal the method amount.");
      return;
    }

    if (hasMethodAllocationOverRemaining) {
      setMethodMessage(
        "Method allocation cannot exceed the remaining allocation for an invoice.",
      );
      return;
    }

    const allocations = selectedAllocationInvoices
      .map((invoice) => ({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: methodAllocationAmounts[invoice.id] ?? "",
      }))
      .filter((allocation) => parseAmount(allocation.amount) > 0);

    if (allocations.length === 0) {
      setMethodMessage("Add at least one method allocation amount.");
      return;
    }

    setAddedMethods((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        method: selectedMethod,
        amount: amount.toFixed(2),
        details: getMethodDetails({
          chequeBank,
          chequeDate,
          chequeNumber,
          method: selectedMethod,
          referenceNumber,
        }),
        chequeNumber:
          selectedMethod === "CHEQUE" ? chequeNumber.trim() : undefined,
        chequeBank: selectedMethod === "CHEQUE" ? chequeBank.trim() : undefined,
        chequeDate: selectedMethod === "CHEQUE" ? chequeDate : undefined,
        bankReference:
          selectedMethod === "BANK_TRANSFER"
            ? referenceNumber.trim()
            : undefined,
        cardReference:
          selectedMethod === "CARD" ? referenceNumber.trim() : undefined,
        allocations,
      },
    ]);
    setSelectedMethod("");
    setMethodAmount("");
    setChequeNumber("");
    setChequeBank("");
    setChequeDate("");
    setReferenceNumber("");
    setMethodAllocationAmounts({});
    setMethodMessage("");
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
                    <th scope="col" className="px-4 py-3 text-right">
                      Invoice Total
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Outstanding
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Due Date
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Allocate
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
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(invoice.invoiceTotal)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                          {formatAmount(invoice.outstandingAmount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {formatDate(invoice.dueDate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            {invoice.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <input
                            name={`allocationAmount:${invoice.id}`}
                            type="number"
                            min="0"
                            max={invoice.outstandingAmount}
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
            <span className="text-sm text-zinc-600">
              Overall Invoice Allocation Total:
            </span>
            <span className="text-lg font-semibold text-zinc-950">
              {formatAmount(totalAllocated)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
        <h2 className="text-lg font-medium tracking-tight">Payment Method</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {paymentMethods.map((method) => (
            <label
              key={method.id}
              className="flex cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white p-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 has-checked:border-zinc-950 has-checked:bg-zinc-50 has-checked:ring-1 has-checked:ring-zinc-950"
            >
              <input
                type="radio"
                name="methodDraft"
                checked={selectedMethod === method.id}
                onChange={() => setSelectedMethod(method.id)}
                className="sr-only"
              />
              {method.label}
            </label>
          ))}
        </div>

        <div className="grid gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
          <Field
            label="Amount"
            name="methodAmountDraft"
            type="number"
            min="0"
            step="0.01"
            value={methodAmount}
            onChange={setMethodAmount}
          />
          {selectedMethod === "CHEQUE" && (
            <>
              <Field
                label="Cheque Number"
                name="chequeNumberDraft"
                value={chequeNumber}
                onChange={setChequeNumber}
              />
              <BankSelect value={chequeBank} onChange={setChequeBank} />
              <Field
                label="Cheque Date"
                name="chequeDateDraft"
                type="date"
                value={chequeDate}
                onChange={setChequeDate}
              />
            </>
          )}
          {selectedMethod === "BANK_TRANSFER" && (
            <Field
              label="Reference Number"
              name="bankReferenceDraft"
              value={referenceNumber}
              onChange={setReferenceNumber}
            />
          )}
          {selectedMethod === "CARD" && (
            <Field
              label="Reference Number"
              name="cardReferenceDraft"
              value={referenceNumber}
              onChange={setReferenceNumber}
            />
          )}
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-950">
            Method Allocations
          </h3>
          {selectedAllocationInvoices.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Select invoices above to allocate this method.
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {selectedAllocationInvoices.map((invoice) => {
                const remainingAllocation =
                  remainingAllocationByInvoice[invoice.id] ?? 0;

                return (
                  <label
                    key={invoice.id}
                    className="grid gap-2 text-sm font-medium text-zinc-800 sm:grid-cols-[1fr_160px] sm:items-center"
                  >
                    <span>
                      {invoice.invoiceNumber}{" "}
                      <span className="font-normal text-zinc-500">
                        (Remaining: {formatAmount(remainingAllocation)})
                      </span>
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={remainingAllocation}
                      step="0.01"
                      value={methodAllocationAmounts[invoice.id] ?? ""}
                      onChange={(event) =>
                        updateMethodAllocationAmount(
                          invoice.id,
                          event.target.value,
                        )
                      }
                      className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-right text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                    />
                  </label>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3">
            <span className="text-sm text-zinc-600">
              Method Allocation Total:
            </span>
            <span className="text-sm font-semibold text-zinc-950">
              {formatAmount(methodAllocationTotal)}
            </span>
          </div>
          {methodMessage && (
            <p className="mt-3 text-sm font-medium text-amber-700">
              {methodMessage}
            </p>
          )}
          {canSavePayment ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={addMethod}
                disabled={!canAddMethod}
                className={
                  canAddMethod
                    ? "inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                    : "inline-flex h-10 cursor-not-allowed items-center justify-center rounded-md bg-zinc-300 px-4 text-sm font-medium text-zinc-600"
                }
              >
                Add Method
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
        <h2 className="text-lg font-medium tracking-tight">Methods Added</h2>
        {addedMethods.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
            No methods added yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase text-zinc-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Method
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Amount
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Details
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Allocations
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {addedMethods.map((method) => (
                    <tr key={method.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950">
                        {getMethodLabel(method.method)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-600">
                        {formatAmount(method.amount)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {method.details || "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {method.allocations
                          .map(
                            (allocation) =>
                              `${allocation.invoiceNumber}: ${formatAmount(
                                allocation.amount,
                              )}`,
                          )
                          .join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">
              Total of Added Methods:
            </span>
            <span className="text-lg font-semibold text-zinc-950">
              {formatAmount(addedMethodsTotal)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        {addedMethods.map((method) => (
          <div key={method.id} className="hidden">
            <input type="hidden" name="addedMethodIds" value={method.id} />
            <input
              type="hidden"
              name={`addedMethod:${method.id}:method`}
              value={method.method}
            />
            <input
              type="hidden"
              name={`addedMethod:${method.id}:amount`}
              value={method.amount}
            />
            <input
              type="hidden"
              name={`addedMethod:${method.id}:chequeNumber`}
              value={method.chequeNumber ?? ""}
            />
            <input
              type="hidden"
              name={`addedMethod:${method.id}:chequeBankName`}
              value={method.chequeBank ?? ""}
            />
            <input
              type="hidden"
              name={`addedMethod:${method.id}:chequeDate`}
              value={method.chequeDate ?? ""}
            />
            <input
              type="hidden"
              name={`addedMethod:${method.id}:bankReference`}
              value={method.bankReference ?? ""}
            />
            <input
              type="hidden"
              name={`addedMethod:${method.id}:cardReference`}
              value={method.cardReference ?? ""}
            />
            {method.allocations.map((allocation) => (
              <div key={allocation.invoiceId}>
                <input
                  type="hidden"
                  name={`addedMethod:${method.id}:invoiceIds`}
                  value={allocation.invoiceId}
                />
                <input
                  type="hidden"
                  name={`addedMethod:${method.id}:allocation:${allocation.invoiceId}`}
                  value={allocation.amount}
                />
              </div>
            ))}
          </div>
        ))}
        <p
          className={
            finalTotalsMatch
              ? "text-sm font-medium text-emerald-700"
              : "text-sm font-medium text-zinc-600"
          }
        >
          {finalTotalsMatch
            ? "Ready to save payment."
            : "Added methods must match overall invoice allocations before saving."}
        </p>
        <div className="flex justify-end gap-3">
          <Link
            href="/payments"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100"
          >
            Cancel
          </Link>
          {canSavePayment ? (
            <button
              type="submit"
              formAction={saveAction}
              disabled={!finalTotalsMatch}
              className={
                finalTotalsMatch
                  ? "inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                  : "inline-flex h-10 cursor-not-allowed items-center justify-center rounded-md bg-zinc-300 px-4 text-sm font-medium text-zinc-600"
              }
            >
              Save Payment
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

function getMethodDetails({
  chequeBank,
  chequeDate,
  chequeNumber,
  method,
  referenceNumber,
}: {
  chequeBank: string;
  chequeDate: string;
  chequeNumber: string;
  method: PaymentMethod;
  referenceNumber: string;
}) {
  if (method === "CHEQUE") {
    return [
      chequeNumber ? `Cheque ${chequeNumber}` : "",
      chequeBank,
      chequeDate,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  if (method === "BANK_TRANSFER" || method === "CARD") {
    return referenceNumber ? `Ref ${referenceNumber}` : "";
  }

  return "";
}

function BankSelect({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
      Bank
      <select
        name="chequeBankName"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      >
        <option value="">Select bank</option>
        {BANK_OPTIONS.map((bank) => (
          <option key={bank} value={bank}>
            {bank}
          </option>
        ))}
      </select>
    </label>
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
