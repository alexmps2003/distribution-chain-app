import { Injectable, NotFoundException } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  customers,
  invoices,
  paymentAllocations,
  paymentParts,
} from '../db/schema';

@Injectable()
export class OutstandingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(customerId?: string) {
    const customerRows = await this.databaseService.db
      .select()
      .from(customers)
      .orderBy(asc(customers.name));
    const invoiceRows = await this.databaseService.db
      .select()
      .from(invoices)
      .orderBy(asc(invoices.dueDate));
    const allocationRows = await this.databaseService.db
      .select()
      .from(paymentAllocations);
    const paymentPartRows = await this.databaseService.db
      .select()
      .from(paymentParts);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paymentPartById = new Map(
      paymentPartRows.map((paymentPart) => [paymentPart.id, paymentPart]),
    );
    const invoicesByCustomerId = new Map<
      string,
      (typeof invoices.$inferSelect)[]
    >();
    const allocationsByInvoiceId = new Map<
      string,
      (typeof paymentAllocations.$inferSelect)[]
    >();

    for (const invoice of invoiceRows) {
      const customerInvoices = invoicesByCustomerId.get(invoice.customerId) ?? [];
      customerInvoices.push(invoice);
      invoicesByCustomerId.set(invoice.customerId, customerInvoices);
    }

    for (const allocation of allocationRows) {
      const invoiceAllocations =
        allocationsByInvoiceId.get(allocation.invoiceId) ?? [];
      invoiceAllocations.push(allocation);
      allocationsByInvoiceId.set(allocation.invoiceId, invoiceAllocations);
    }

    const outstandingCustomers = customerRows
      .map((customer) => {
        const customerInvoices = invoicesByCustomerId.get(customer.id) ?? [];
        const outstandingInvoices = customerInvoices
          .map((invoice) => {
            const invoiceAllocations =
              allocationsByInvoiceId.get(invoice.id) ?? [];
            const activePaidCents = invoiceAllocations.reduce(
              (sum, allocation) => {
                if (!allocation.paymentPartId) {
                  return sum + this.toCents(allocation.amount);
                }

                const paymentPart = paymentPartById.get(
                  allocation.paymentPartId,
                );

                if (paymentPart?.status === 'ACTIVE') {
                  return sum + this.toCents(allocation.amount);
                }

                return sum;
              },
              0,
            );
            const amountCents = this.toCents(invoice.amount);
            const outstandingCents = amountCents - activePaidCents;
            const daysOverdue = this.getDaysOverdue(invoice.dueDate, today);

            return {
              ...invoice,
              amount: this.fromCents(amountCents),
              activePaidAmount: this.fromCents(activePaidCents),
              outstanding: this.fromCents(outstandingCents),
              displayStatus: this.getDisplayStatus(
                activePaidCents,
                outstandingCents,
              ),
              daysOverdue,
            };
          })
          .filter((invoice) => this.toCents(invoice.outstanding) > 0);
        const totalOutstandingCents = outstandingInvoices.reduce(
          (sum, invoice) => sum + this.toCents(invoice.outstanding),
          0,
        );

        return {
          customer,
          totalOutstanding: this.fromCents(totalOutstandingCents),
          outstandingInvoiceCount: outstandingInvoices.length,
          oldestDueDate: this.getOldestDueDate(outstandingInvoices),
          invoices: outstandingInvoices,
        };
      })
      .filter((customer) => this.toCents(customer.totalOutstanding) > 0);

    const totalOutstandingCents = outstandingCustomers.reduce(
      (sum, customer) => sum + this.toCents(customer.totalOutstanding),
      0,
    );
    const overdueInvoiceCount = outstandingCustomers.reduce(
      (count, customer) =>
        count +
        customer.invoices.filter((invoice) => invoice.daysOverdue !== null)
          .length,
      0,
    );
    const highestOutstandingCustomer = [...outstandingCustomers].sort(
      (left, right) =>
        this.toCents(right.totalOutstanding) -
        this.toCents(left.totalOutstanding),
    )[0];

    if (customerId) {
      const customer = customerRows.find((row) => row.id === customerId);

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const outstandingCustomer = outstandingCustomers.find(
        (row) => row.customer.id === customerId,
      );
      const outstandingInvoices = outstandingCustomer?.invoices ?? [];

      return {
        customer,
        summary: {
          totalOutstanding:
            outstandingCustomer?.totalOutstanding ?? this.fromCents(0),
          outstandingInvoiceCount: outstandingInvoices.length,
          oldestDueDate: outstandingCustomer?.oldestDueDate ?? null,
        },
        invoices: outstandingInvoices.map((invoice) => ({
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            status: invoice.status,
            customerId: invoice.customerId,
            createdAt: invoice.createdAt,
          },
          activePaidAmount: invoice.activePaidAmount,
          outstanding: invoice.outstanding,
          displayStatus: invoice.displayStatus,
          daysOverdue: invoice.daysOverdue,
        })),
      };
    }

    return {
      summary: {
        customerCount: outstandingCustomers.length,
        totalOutstanding: this.fromCents(totalOutstandingCents),
        overdueInvoiceCount,
        highestOutstandingCustomer: highestOutstandingCustomer
          ? {
              ...highestOutstandingCustomer.customer,
              totalOutstanding: highestOutstandingCustomer.totalOutstanding,
            }
          : null,
      },
      customers: outstandingCustomers,
    };
  }

  private getDisplayStatus(paidCents: number, outstandingCents: number) {
    if (outstandingCents <= 0) {
      return 'PAID';
    }

    if (paidCents > 0) {
      return 'PARTIALLY_PAID';
    }

    return 'UNPAID';
  }

  private getDaysOverdue(dueDate: Date | null, today: Date) {
    if (!dueDate) {
      return null;
    }

    const normalizedDueDate = new Date(dueDate);
    normalizedDueDate.setHours(0, 0, 0, 0);

    if (normalizedDueDate >= today) {
      return null;
    }

    return Math.floor(
      (today.getTime() - normalizedDueDate.getTime()) / 86_400_000,
    );
  }

  private getOldestDueDate(invoices: { dueDate: Date | null }[]) {
    const dueDates = invoices
      .map((invoice) => invoice.dueDate)
      .filter((date): date is Date => date !== null)
      .sort((left, right) => left.getTime() - right.getTime());

    return dueDates[0] ?? null;
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
