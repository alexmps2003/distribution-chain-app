import { Injectable } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  customers,
  invoices,
  paymentAllocations,
  paymentParts,
} from '../db/schema';

const bucketOrder = [
  'notDue',
  'days0To30',
  'days31To60',
  'days61To90',
  'days90Plus',
  'noDueDate',
] as const;

type BucketKey = (typeof bucketOrder)[number];

const bucketLabels: Record<BucketKey, string> = {
  days0To30: '0-30 days overdue',
  days31To60: '31-60 days overdue',
  days61To90: '61-90 days overdue',
  days90Plus: '90+ days overdue',
  noDueDate: 'No Due Date',
  notDue: 'Not Due',
};

@Injectable()
export class AgingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const invoiceRows = await this.databaseService.db
      .select()
      .from(invoices)
      .orderBy(asc(invoices.dueDate), asc(invoices.invoiceDate));
    const customerRows = await this.databaseService.db.select().from(customers);
    const allocationRows = await this.databaseService.db
      .select()
      .from(paymentAllocations);
    const paymentPartRows = await this.databaseService.db
      .select()
      .from(paymentParts);

    const today = this.startOfToday();
    const customerById = new Map(
      customerRows.map((customer) => [customer.id, customer]),
    );
    const paymentPartById = new Map(
      paymentPartRows.map((paymentPart) => [paymentPart.id, paymentPart]),
    );
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

    const outstandingInvoices = invoiceRows
      .map((invoice) => {
        const customer = customerById.get(invoice.customerId);

        if (!customer) {
          return null;
        }

        const invoiceAllocations = allocationsByInvoiceId.get(invoice.id) ?? [];
        const activePaidCents = this.getActivePaidCents(
          invoiceAllocations,
          paymentPartById,
        );
        const amountCents = this.toCents(invoice.amount);
        const outstandingCents = amountCents - activePaidCents;

        if (outstandingCents <= 0) {
          return null;
        }

        const daysOverdue = this.getDaysOverdue(invoice.dueDate, today);
        const bucket = this.getAgingBucket(daysOverdue);

        return {
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            status: invoice.status,
            customerId: invoice.customerId,
            createdAt: invoice.createdAt,
          },
          customer: {
            area: customer.area,
            code: customer.code,
            id: customer.id,
            name: customer.name,
            routeName: customer.routeName,
          },
          amount: this.fromCents(amountCents),
          activePaidAmount: this.fromCents(activePaidCents),
          outstanding: this.fromCents(outstandingCents),
          dueDate: invoice.dueDate,
          daysOverdue,
          bucket: bucketLabels[bucket],
          status: this.getDisplayStatus(amountCents, activePaidCents),
        };
      })
      .filter((invoice): invoice is NonNullable<typeof invoice> =>
        Boolean(invoice),
      );

    const bucketTotals = this.createEmptyBucketTotals();

    for (const invoice of outstandingInvoices) {
      const bucket = this.getAgingBucket(invoice.daysOverdue);
      const existing = bucketTotals[bucket];

      bucketTotals[bucket] = {
        invoiceCount: existing.invoiceCount + 1,
        totalOutstandingCents:
          existing.totalOutstandingCents + this.toCents(invoice.outstanding),
      };
    }

    const totalOutstandingCents = outstandingInvoices.reduce(
      (sum, invoice) => sum + this.toCents(invoice.outstanding),
      0,
    );
    const overdueInvoices = outstandingInvoices.filter((invoice) => {
      return invoice.daysOverdue !== null && invoice.daysOverdue >= 0;
    });
    const overdueOutstandingCents = overdueInvoices.reduce(
      (sum, invoice) => sum + this.toCents(invoice.outstanding),
      0,
    );
    const ninetyPlusOutstandingCents = outstandingInvoices
      .filter((invoice) => invoice.bucket === bucketLabels.days90Plus)
      .reduce((sum, invoice) => sum + this.toCents(invoice.outstanding), 0);

    return {
      summary: {
        totalOutstanding: this.fromCents(totalOutstandingCents),
        overdueOutstanding: this.fromCents(overdueOutstandingCents),
        ninetyPlusOutstanding: this.fromCents(ninetyPlusOutstandingCents),
        overdueInvoiceCount: overdueInvoices.length,
      },
      buckets: bucketOrder.map((bucket) => ({
        name: bucketLabels[bucket],
        totalOutstanding: this.fromCents(
          bucketTotals[bucket].totalOutstandingCents,
        ),
        invoiceCount: bucketTotals[bucket].invoiceCount,
      })),
      invoices: outstandingInvoices,
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

  private getDisplayStatus(invoiceTotalCents: number, paidCents: number) {
    if (paidCents >= invoiceTotalCents) {
      return 'PAID';
    }

    if (paidCents > 0) {
      return 'PARTIALLY_PAID';
    }

    return 'UNPAID';
  }

  private startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return today;
  }

  private getDaysOverdue(dueDate: Date | null, today: Date) {
    if (!dueDate) {
      return null;
    }

    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
  }

  private getAgingBucket(daysOverdue: number | null): BucketKey {
    if (daysOverdue === null) {
      return 'noDueDate';
    }

    if (daysOverdue < 0) {
      return 'notDue';
    }

    if (daysOverdue <= 30) {
      return 'days0To30';
    }

    if (daysOverdue <= 60) {
      return 'days31To60';
    }

    if (daysOverdue <= 90) {
      return 'days61To90';
    }

    return 'days90Plus';
  }

  private createEmptyBucketTotals() {
    return {
      days0To30: { invoiceCount: 0, totalOutstandingCents: 0 },
      days31To60: { invoiceCount: 0, totalOutstandingCents: 0 },
      days61To90: { invoiceCount: 0, totalOutstandingCents: 0 },
      days90Plus: { invoiceCount: 0, totalOutstandingCents: 0 },
      noDueDate: { invoiceCount: 0, totalOutstandingCents: 0 },
      notDue: { invoiceCount: 0, totalOutstandingCents: 0 },
    } satisfies Record<
      BucketKey,
      { invoiceCount: number; totalOutstandingCents: number }
    >;
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
