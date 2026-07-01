import { Injectable } from '@nestjs/common';

type MoneyValue = string | number;

type PaymentReceivedInput = {
  amount: MoneyValue;
  customerName: string;
  outstanding: MoneyValue;
};

type ChequeReversedInput = {
  amount: MoneyValue;
  chequeNumber: string;
  customerName: string;
  reason?: string | null;
};

type ChequeReversalUndoneInput = {
  amount: MoneyValue;
  chequeNumber: string;
  customerName: string;
};

type InvoiceCreatedInput = {
  amount: MoneyValue;
  customerName: string;
  dueDate?: Date | string | null;
  invoiceNumber: string;
};

@Injectable()
export class SmsTemplateService {
  paymentReceived({
    amount,
    customerName,
    outstanding,
  }: PaymentReceivedInput): string {
    return [
      'Distribio',
      '',
      'Payment Received',
      '',
      `Customer: ${customerName}`,
      `Amount: ${this.formatAmount(amount)}`,
      `Outstanding: ${this.formatAmount(outstanding)}`,
      '',
      'Thank you.',
    ].join('\n');
  }

  chequeReversed({
    amount,
    chequeNumber,
    customerName,
    reason,
  }: ChequeReversedInput): string {
    return [
      'Distribio',
      '',
      'Cheque Reversed',
      '',
      `Customer: ${customerName}`,
      `Cheque No: ${chequeNumber}`,
      `Amount: ${this.formatAmount(amount)}`,
      reason ? `Reason: ${reason}` : null,
      '',
      'Please contact us if you need assistance.',
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }

  chequeReversalUndone({
    amount,
    chequeNumber,
    customerName,
  }: ChequeReversalUndoneInput): string {
    return [
      'Distribio',
      '',
      'Cheque Reversal Undone',
      '',
      `Customer: ${customerName}`,
      `Cheque No: ${chequeNumber}`,
      `Amount: ${this.formatAmount(amount)}`,
      '',
      'Thank you.',
    ].join('\n');
  }

  invoiceCreated({
    amount,
    customerName,
    dueDate,
    invoiceNumber,
  }: InvoiceCreatedInput): string {
    return [
      'Distribio',
      '',
      'Invoice Created',
      '',
      `Customer: ${customerName}`,
      `Invoice No: ${invoiceNumber}`,
      `Amount: ${this.formatAmount(amount)}`,
      dueDate ? `Due Date: ${this.formatDate(dueDate)}` : null,
      '',
      'Thank you.',
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

  private formatDate(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
