import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  customers,
  invoices,
  paymentAllocations,
  paymentParts,
  payments,
} from '../db/schema';

@Injectable()
export class DashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findSummary() {
    const [
      customerRows,
      invoiceRows,
      allocationRows,
      paymentPartRows,
      paymentRows,
    ] = await Promise.all([
      this.databaseService.db.select().from(customers),
      this.databaseService.db.select().from(invoices),
      this.databaseService.db.select().from(paymentAllocations),
      this.databaseService.db.select().from(paymentParts),
      this.databaseService.db.select().from(payments),
    ]);

    const today = new Date();
    const customerById = new Map(
      customerRows.map((customer) => [customer.id, customer]),
    );
    const paymentById = new Map(
      paymentRows.map((payment) => [payment.id, payment]),
    );
    const paymentPartById = new Map(
      paymentPartRows.map((paymentPart) => [paymentPart.id, paymentPart]),
    );
    const invoiceIds = new Set(invoiceRows.map((invoice) => invoice.id));
    const allocationsByInvoiceId = new Map<
      string,
      (typeof paymentAllocations.$inferSelect)[]
    >();

    for (const allocation of allocationRows) {
      const invoiceAllocations =
        allocationsByInvoiceId.get(allocation.invoiceId) ?? [];
      invoiceAllocations.push(allocation);
      allocationsByInvoiceId.set(allocation.invoiceId, invoiceAllocations);
    }

    const invoiceSummaries = invoiceRows.map((invoice) => {
      const invoiceAllocations = allocationsByInvoiceId.get(invoice.id) ?? [];
      const activePaidCents = this.getActivePaidCents(
        invoiceAllocations,
        paymentPartById,
      );
      const amountCents = this.toCents(invoice.amount);
      const outstandingCents = amountCents - activePaidCents;

      return {
        invoice,
        activePaidCents,
        amountCents,
        displayStatus: this.getInvoiceDisplayStatus(
          amountCents,
          activePaidCents,
        ),
        outstandingCents,
      };
    });

    const totalInvoicedCents = invoiceSummaries.reduce(
      (sum, invoice) => sum + invoice.amountCents,
      0,
    );
    const totalPaidCents = invoiceSummaries.reduce(
      (sum, invoice) => sum + invoice.activePaidCents,
      0,
    );
    const outstandingByCustomer = new Map<
      string,
      {
        area: string | null;
        code: string;
        id: string;
        invoiceCount: number;
        isActive: boolean;
        name: string;
        outstandingCents: number;
        overdueOutstandingCents: number;
        routeName: string | null;
      }
    >();

    for (const invoiceSummary of invoiceSummaries) {
      if (invoiceSummary.outstandingCents <= 0) {
        continue;
      }

      const customer = customerById.get(invoiceSummary.invoice.customerId);

      if (!customer) {
        continue;
      }

      const existing = outstandingByCustomer.get(customer.id);

      outstandingByCustomer.set(customer.id, {
        area: customer.area?.trim() || null,
        code: customer.code,
        id: customer.id,
        invoiceCount: (existing?.invoiceCount ?? 0) + 1,
        isActive: customer.isActive,
        name: customer.name,
        outstandingCents:
          (existing?.outstandingCents ?? 0) + invoiceSummary.outstandingCents,
        overdueOutstandingCents:
          (existing?.overdueOutstandingCents ?? 0) +
          (this.isOverdue(invoiceSummary.invoice.dueDate, today)
            ? invoiceSummary.outstandingCents
            : 0),
        routeName: customer.routeName?.trim() || null,
      });
    }

    const highOutstandingCustomers = Array.from(outstandingByCustomer.values())
      .sort((left, right) => right.outstandingCents - left.outstandingCents)
      .slice(0, 5)
      .map((customer) => ({
        area: customer.area,
        code: customer.code,
        id: customer.id,
        invoiceCount: customer.invoiceCount,
        isActive: customer.isActive,
        name: customer.name,
        outstanding: this.fromCents(customer.outstandingCents),
        overdueOutstanding: this.fromCents(customer.overdueOutstandingCents),
        routeName: customer.routeName,
      }));
    const areaOptions = Array.from(
      new Set(
        customerRows
          .map((customer) => customer.area?.trim())
          .filter((area): area is string => Boolean(area)),
      ),
    ).sort((left, right) => left.localeCompare(right));
    const routeOptions = Array.from(
      new Set(
        customerRows
          .map((customer) => customer.routeName?.trim())
          .filter((route): route is string => Boolean(route)),
      ),
    ).sort((left, right) => left.localeCompare(right));

    const invoiceStatus = invoiceSummaries.reduce(
      (counts, invoice) => {
        if (invoice.displayStatus === 'PAID') {
          return { ...counts, PAID: counts.PAID + 1 };
        }

        if (invoice.displayStatus === 'PARTIALLY_PAID') {
          return {
            ...counts,
            PARTIALLY_PAID: counts.PARTIALLY_PAID + 1,
          };
        }

        return { ...counts, UNPAID: counts.UNPAID + 1 };
      },
      { PAID: 0, PARTIALLY_PAID: 0, UNPAID: 0 },
    );
    const monthlyCollectionsByKey = new Map<
      string,
      {
        amountCents: number;
        date: Date;
        month: string;
        receiptIds: Set<string>;
      }
    >();

    for (const allocation of allocationRows) {
      if (!invoiceIds.has(allocation.invoiceId)) {
        continue;
      }

      if (!this.isActiveAllocation(allocation, paymentPartById)) {
        continue;
      }

      const payment = paymentById.get(allocation.paymentId);

      if (!payment) {
        continue;
      }

      const monthKey = payment.paymentDate.toISOString().slice(0, 7);
      const existing = monthlyCollectionsByKey.get(monthKey);

      monthlyCollectionsByKey.set(monthKey, {
        amountCents:
          (existing?.amountCents ?? 0) + this.toCents(allocation.amount),
        date: existing?.date ?? payment.paymentDate,
        month: existing?.month ?? this.getMonthLabel(payment.paymentDate),
        receiptIds: new Set([
          ...(existing?.receiptIds ?? []),
          allocation.paymentId,
        ]),
      });
    }

    const monthlyCollections = Array.from(monthlyCollectionsByKey.entries())
      .sort((left, right) => left[1].date.getTime() - right[1].date.getTime())
      .map(([monthKey, month]) => ({
        amount: this.fromCents(month.amountCents),
        month: month.month,
        monthKey,
        receiptCount: month.receiptIds.size,
      }));
    const recentPayments = paymentRows
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .slice(0, 5)
      .map((payment) => {
        const customer = customerById.get(payment.customerId);

        return {
          ...payment,
          customer: customer
            ? {
                code: customer.code,
                id: customer.id,
                name: customer.name,
              }
            : null,
        };
      });
    const activeCheques = paymentPartRows.filter((paymentPart) => {
      return paymentPart.method === 'CHEQUE' && paymentPart.status === 'ACTIVE';
    }).length;
    const reversedCheques = paymentPartRows.filter((paymentPart) => {
      return (
        paymentPart.method === 'CHEQUE' && paymentPart.status === 'REVERSED'
      );
    }).length;

    return {
      summary: {
        totalCustomers: customerRows.length,
        totalInvoiced: this.fromCents(totalInvoicedCents),
        totalPaid: this.fromCents(totalPaidCents),
        totalOutstanding: this.fromCents(totalInvoicedCents - totalPaidCents),
        activeCheques,
        reversedCheques,
      },
      filterOptions: {
        areaOptions,
        routeOptions,
      },
      recentPayments,
      highOutstandingCustomers,
      invoiceStatus,
      monthlyCollections,
    };
  }

  private getActivePaidCents(
    allocations: (typeof paymentAllocations.$inferSelect)[],
    paymentPartById: Map<string, typeof paymentParts.$inferSelect>,
  ) {
    return allocations.reduce((sum, allocation) => {
      if (this.isActiveAllocation(allocation, paymentPartById)) {
        return sum + this.toCents(allocation.amount);
      }

      return sum;
    }, 0);
  }

  private isActiveAllocation(
    allocation: typeof paymentAllocations.$inferSelect,
    paymentPartById: Map<string, typeof paymentParts.$inferSelect>,
  ) {
    if (!allocation.paymentPartId) {
      return true;
    }

    return paymentPartById.get(allocation.paymentPartId)?.status === 'ACTIVE';
  }

  private getInvoiceDisplayStatus(
    invoiceTotalCents: number,
    paidCents: number,
  ) {
    if (paidCents >= invoiceTotalCents) {
      return 'PAID';
    }

    if (paidCents > 0) {
      return 'PARTIALLY_PAID';
    }

    return 'UNPAID';
  }

  private getMonthLabel(date: Date) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }

  private isOverdue(dueDate: Date | null, today: Date) {
    return dueDate !== null && dueDate < today;
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
