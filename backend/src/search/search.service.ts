import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  customers,
  invoices,
  paymentParts,
  payments,
} from '../db/schema';

@Injectable()
export class SearchService {
  constructor(private readonly databaseService: DatabaseService) {}

  async search(query: string) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return {
        customers: [],
        invoices: [],
        payments: [],
        cheques: [],
      };
    }

    const [customerRows, invoiceRows, paymentRows, paymentPartRows] =
      await Promise.all([
        this.databaseService.db.select().from(customers),
        this.databaseService.db.select().from(invoices),
        this.databaseService.db.select().from(payments),
        this.databaseService.db.select().from(paymentParts),
      ]);

    const customerById = new Map(
      customerRows.map((customer) => [customer.id, customer]),
    );
    const paymentById = new Map(
      paymentRows.map((payment) => [payment.id, payment]),
    );
    const partsByPaymentId = new Map<
      string,
      (typeof paymentParts.$inferSelect)[]
    >();
    const matchesReceiptReference = (payment: typeof payments.$inferSelect) =>
      this.includesSearch(this.formatPaymentReference(payment), normalizedQuery);

    for (const part of paymentPartRows) {
      const parts = partsByPaymentId.get(part.paymentId) ?? [];
      parts.push(part);
      partsByPaymentId.set(part.paymentId, parts);
    }

    const customerResults = customerRows
      .filter((customer) => {
        return (
          this.includesSearch(customer.name, normalizedQuery) ||
          this.includesSearch(customer.code, normalizedQuery)
        );
      })
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 10)
      .map((customer) => ({
        id: customer.id,
        code: customer.code,
        name: customer.name,
      }));
    const invoiceResults = invoiceRows
      .filter((invoice) =>
        this.includesSearch(invoice.invoiceNumber, normalizedQuery),
      )
      .sort((left, right) => right.invoiceDate.getTime() - left.invoiceDate.getTime())
      .slice(0, 10)
      .map((invoice) => {
        const customer = customerById.get(invoice.customerId);

        return {
          invoice,
          customer: customer
            ? {
                code: customer.code,
                id: customer.id,
                name: customer.name,
              }
            : null,
          amount: invoice.amount,
        };
      });
    const paymentResults = paymentRows
      .filter((payment) => {
        const parts = partsByPaymentId.get(payment.id) ?? [];

        return (
          this.includesSearch(payment.id, normalizedQuery) ||
          matchesReceiptReference(payment) ||
          parts.some((part) => {
            return (
              this.includesSearch(part.bankReference, normalizedQuery) ||
              this.includesSearch(part.cardReference, normalizedQuery) ||
              this.includesSearch(part.chequeNumber, normalizedQuery)
            );
          })
        );
      })
      .sort((left, right) => right.paymentDate.getTime() - left.paymentDate.getTime())
      .slice(0, 10)
      .map((payment) => {
        const customer = customerById.get(payment.customerId);

        return {
          payment,
          receiptReference: this.formatPaymentReference(payment),
          customer: customer
            ? {
                code: customer.code,
                id: customer.id,
                name: customer.name,
              }
            : null,
          parts: partsByPaymentId.get(payment.id) ?? [],
        };
      });
    const chequeResults = paymentPartRows
      .filter((part) => {
        return (
          part.method === 'CHEQUE' &&
          this.includesSearch(part.chequeNumber, normalizedQuery)
        );
      })
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 10)
      .map((cheque) => {
        const payment = paymentById.get(cheque.paymentId);
        const customer = payment ? customerById.get(payment.customerId) : null;

        return {
          cheque,
          payment: payment ?? null,
          customer: customer
            ? {
                code: customer.code,
                id: customer.id,
                name: customer.name,
              }
            : null,
          status: cheque.status,
        };
      });

    return {
      customers: customerResults,
      invoices: invoiceResults,
      payments: paymentResults,
      cheques: chequeResults,
    };
  }

  private includesSearch(value: string | null | undefined, query: string) {
    return value?.toLowerCase().includes(query.toLowerCase()) ?? false;
  }

  private formatPaymentReference(payment: { id: string; paymentDate: Date }) {
    const datePart = payment.paymentDate
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', '');
    const idPart = payment.id.slice(-4).toUpperCase();

    return `PAY-${datePart}-${idPart}`;
  }
}
