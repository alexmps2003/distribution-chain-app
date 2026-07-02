import { Injectable } from '@nestjs/common';

type MoneyValue = string | number;

type PaymentReceivedInput = {
  amount: MoneyValue;
  customerName: string;
  dateTime?: Date | string | null;
  paymentMethod?: string | null;
  receiptNumber?: string | null;
  outstanding: MoneyValue;
};

type ChequeReversedInput = {
  amount: MoneyValue;
  chequeNumber: string;
  customerName: string;
  dateTime?: Date | string | null;
  reason?: string | null;
  outstanding?: MoneyValue | null;
};

type ChequeReversalUndoneInput = {
  amount: MoneyValue;
  chequeNumber: string;
  customerName: string;
  dateTime?: Date | string | null;
  outstanding?: MoneyValue | null;
};

type InvoiceCreatedInput = {
  amount: MoneyValue;
  customerName: string;
  dateTime?: Date | string | null;
  dueDate?: Date | string | null;
  invoiceNumber: string;
  outstanding: MoneyValue;
};

@Injectable()
export class SmsTemplateService {
  paymentReceived({
    amount,
    dateTime,
    paymentMethod,
    receiptNumber,
    outstanding,
  }: PaymentReceivedInput): string {
    return [
      'Distribio',
      'Payment Received',
      receiptNumber ? `Receipt: ${receiptNumber}` : null,
      `Amount: ${this.formatAmount(amount)}`,
      paymentMethod
        ? `Method: ${this.formatPaymentMethod(paymentMethod)}`
        : null,
      `Outstanding: ${this.formatAmount(outstanding)}`,
      this.formatDateTime(dateTime),
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  chequeReversed({
    amount,
    chequeNumber,
    dateTime,
    outstanding,
    reason,
  }: ChequeReversedInput): string {
    return [
      'Distribio',
      'Cheque Reversed',
      `Cheque: ${chequeNumber}`,
      `Amount: ${this.formatAmount(amount)}`,
      this.hasMoneyValue(outstanding)
        ? `Outstanding: ${this.formatAmount(outstanding)}`
        : null,
      this.formatDateTime(dateTime),
      reason ? `Reason: ${reason}` : null,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  chequeReversalUndone({
    amount,
    chequeNumber,
    dateTime,
    outstanding,
  }: ChequeReversalUndoneInput): string {
    return [
      'Distribio',
      'Cheque Restored',
      `Cheque: ${chequeNumber}`,
      `Amount: ${this.formatAmount(amount)}`,
      this.hasMoneyValue(outstanding)
        ? `Outstanding: ${this.formatAmount(outstanding)}`
        : null,
      this.formatDateTime(dateTime),
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  invoiceCreated({
    amount,
    dateTime,
    dueDate,
    invoiceNumber,
    outstanding,
  }: InvoiceCreatedInput): string {
    return [
      'Distribio',
      'Invoice Created',
      `Invoice: ${invoiceNumber}`,
      `Amount: ${this.formatAmount(amount)}`,
      `Outstanding: ${this.formatAmount(outstanding)}`,
      dueDate ? `Due: ${this.formatDate(dueDate)}` : null,
      this.formatDateTime(dateTime),
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  private formatAmount(value: MoneyValue) {
    return `Rs. ${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value))}`;
  }

  private hasMoneyValue(value: MoneyValue | null | undefined) {
    return value !== null && value !== undefined;
  }

  private formatDate(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private formatDateTime(value?: Date | string | null) {
    const date = value
      ? value instanceof Date
        ? value
        : new Date(value)
      : new Date();

    return date.toLocaleString('en-LK', {
      day: '2-digit',
      hour: '2-digit',
      hour12: true,
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private formatPaymentMethod(value: string) {
    return value
      .toLowerCase()
      .split(/[_\s-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
