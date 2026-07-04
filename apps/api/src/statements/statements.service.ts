import { Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  customers,
  invoices,
  paymentAllocations,
  paymentParts,
  payments,
} from '../db/schema';

type LedgerEntry = {
  creditCents: number | null;
  date: Date;
  debitCents: number | null;
  description: string;
  reference: string;
  sortOrder: number;
  type: 'Invoice' | 'Payment' | 'Reversed Cheque';
};

@Injectable()
export class StatementsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findCustomerStatement(id: string) {
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const invoiceRows = await this.databaseService.db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, customer.id))
      .orderBy(asc(invoices.invoiceDate));
    const allocationRows = await this.databaseService.db
      .select()
      .from(paymentAllocations);
    const paymentRows = await this.databaseService.db.select().from(payments);
    const paymentPartRows = await this.databaseService.db
      .select()
      .from(paymentParts);

    const invoiceIds = new Set(invoiceRows.map((invoice) => invoice.id));
    const statementAllocations = allocationRows.filter((allocation) =>
      invoiceIds.has(allocation.invoiceId),
    );
    const allocationsByInvoiceId = new Map<
      string,
      (typeof paymentAllocations.$inferSelect)[]
    >();
    const paymentById = new Map(
      paymentRows.map((payment) => [payment.id, payment]),
    );
    const paymentPartById = new Map(
      paymentPartRows.map((paymentPart) => [paymentPart.id, paymentPart]),
    );

    for (const allocation of statementAllocations) {
      const invoiceAllocations =
        allocationsByInvoiceId.get(allocation.invoiceId) ?? [];
      invoiceAllocations.push(allocation);
      allocationsByInvoiceId.set(allocation.invoiceId, invoiceAllocations);
    }

    const totalInvoicedCents = invoiceRows.reduce(
      (sum, invoice) => sum + this.toCents(invoice.amount),
      0,
    );
    const totalPaidCents = invoiceRows.reduce((sum, invoice) => {
      const invoiceAllocations = allocationsByInvoiceId.get(invoice.id) ?? [];

      return sum + this.getActivePaidCents(invoiceAllocations, paymentPartById);
    }, 0);
    const unpaidInvoiceCount = invoiceRows.filter((invoice) => {
      const invoiceAllocations = allocationsByInvoiceId.get(invoice.id) ?? [];
      const activePaidCents = this.getActivePaidCents(
        invoiceAllocations,
        paymentPartById,
      );

      return activePaidCents < this.toCents(invoice.amount);
    }).length;
    const ledgerEntries: LedgerEntry[] = [];

    for (const invoice of invoiceRows) {
      ledgerEntries.push({
        creditCents: null,
        date: invoice.invoiceDate,
        debitCents: this.toCents(invoice.amount),
        description: `Invoice issued to ${customer.name}`,
        reference: invoice.invoiceNumber,
        sortOrder: 0,
        type: 'Invoice',
      });

      for (const allocation of allocationsByInvoiceId.get(invoice.id) ?? []) {
        const payment = paymentById.get(allocation.paymentId);

        if (!payment) {
          continue;
        }

        const paymentReference = this.formatPaymentReference(payment);
        const paymentPart = allocation.paymentPartId
          ? (paymentPartById.get(allocation.paymentPartId) ?? null)
          : null;

        if (!paymentPart || paymentPart.status === 'ACTIVE') {
          ledgerEntries.push({
            creditCents: this.toCents(allocation.amount),
            date: payment.paymentDate,
            debitCents: null,
            description: `${this.getMethodDetails(
              payment.paymentMethod,
              paymentPart,
            )} allocated to invoice ${invoice.invoiceNumber}`,
            reference: paymentReference,
            sortOrder: 1,
            type: 'Payment',
          });

          continue;
        }

        if (
          paymentPart.method === 'CHEQUE' &&
          paymentPart.status === 'REVERSED'
        ) {
          ledgerEntries.push({
            creditCents: null,
            date: paymentPart.reversedAt ?? payment.paymentDate,
            debitCents: null,
            description: `Reversed cheque allocation of ${this.formatAmount(
              allocation.amount,
            )} for invoice ${invoice.invoiceNumber}. ${
              paymentPart.reversalReason
                ? `Reason: ${paymentPart.reversalReason}`
                : 'This allocation no longer counts toward invoice payments.'
            }`,
            reference: paymentPart.chequeNumber
              ? `Cheque #${paymentPart.chequeNumber}`
              : 'Cheque',
            sortOrder: 2,
            type: 'Reversed Cheque',
          });
        }
      }
    }

    const ledger = ledgerEntries
      .sort((left, right) => {
        const leftDate = this.getCalendarDateKey(left.date);
        const rightDate = this.getCalendarDateKey(right.date);

        if (leftDate !== rightDate) {
          return leftDate.localeCompare(rightDate);
        }

        const byType = left.sortOrder - right.sortOrder;

        if (byType !== 0) {
          return byType;
        }

        return left.date.getTime() - right.date.getTime();
      })
      .reduce<{ balanceCents: number; rows: unknown[] }>(
        (statement, entry) => {
          const balanceCents =
            statement.balanceCents +
            (entry.debitCents ?? 0) -
            (entry.creditCents ?? 0);

          return {
            balanceCents,
            rows: [
              ...statement.rows,
              {
                date: entry.date,
                type: entry.type,
                reference: entry.reference,
                description: entry.description,
                debit:
                  entry.debitCents === null
                    ? null
                    : this.fromCents(entry.debitCents),
                credit:
                  entry.creditCents === null
                    ? null
                    : this.fromCents(entry.creditCents),
                runningBalance: this.fromCents(balanceCents),
              },
            ],
          };
        },
        { balanceCents: 0, rows: [] },
      ).rows;

    return {
      customer,
      summary: {
        totalInvoiced: this.fromCents(totalInvoicedCents),
        totalPaid: this.fromCents(totalPaidCents),
        totalOutstanding: this.fromCents(totalInvoicedCents - totalPaidCents),
        unpaidInvoiceCount,
      },
      ledger,
    };
  }

  private getActivePaidCents(
    allocations: (typeof paymentAllocations.$inferSelect)[],
    paymentPartById: Map<string, typeof paymentParts.$inferSelect>,
  ) {
    return allocations.reduce((sum, allocation) => {
      if (!allocation.paymentPartId) {
        return sum + this.toCents(allocation.amount);
      }

      const paymentPart = paymentPartById.get(allocation.paymentPartId);

      if (paymentPart?.status === 'ACTIVE') {
        return sum + this.toCents(allocation.amount);
      }

      return sum;
    }, 0);
  }

  private getMethodDetails(
    paymentMethod: string,
    paymentPart: typeof paymentParts.$inferSelect | null,
  ) {
    if (!paymentPart) {
      return this.formatMethod(paymentMethod || 'Payment');
    }

    if (paymentPart.method === 'CHEQUE') {
      return [
        'Cheque',
        paymentPart.chequeNumber ? `#${paymentPart.chequeNumber}` : '',
        paymentPart.chequeBank ?? '',
        paymentPart.chequeDate ? this.formatDate(paymentPart.chequeDate) : '',
      ]
        .filter(Boolean)
        .join(' · ');
    }

    if (paymentPart.method === 'BANK_TRANSFER') {
      return paymentPart.bankReference
        ? `Bank Transfer · Ref ${paymentPart.bankReference}`
        : 'Bank Transfer';
    }

    if (paymentPart.method === 'CARD') {
      return paymentPart.cardReference
        ? `Card · Ref ${paymentPart.cardReference}`
        : 'Card';
    }

    return this.formatMethod(paymentPart.method);
  }

  private formatMethod(method: string) {
    return method
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private formatPaymentReference(payment: { id: string; paymentDate: Date }) {
    const datePart = payment.paymentDate
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', '');
    const idPart = payment.id.slice(-4).toUpperCase();

    return `PAY-${datePart}-${idPart}`;
  }

  private formatDate(date: Date) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private formatAmount(value: string | number) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  private getCalendarDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private toCents(value: string | number) {
    const text = String(value);
    const sign = text.startsWith('-') ? -1 : 1;
    const [wholePart, fractionPart = ''] = text.replace('-', '').split('.');
    const wholeCents = Number(wholePart || '0') * 100;
    const fractionCents = Number(fractionPart.padEnd(2, '0').slice(0, 2));

    return sign * (wholeCents + fractionCents);
  }

  private fromCents(value: number) {
    const sign = value < 0 ? '-' : '';
    const absoluteValue = Math.abs(value);
    const whole = Math.floor(absoluteValue / 100);
    const fraction = String(absoluteValue % 100).padStart(2, '0');

    return `${sign}${whole}.${fraction}`;
  }
}
