import { Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import {
  customers,
  invoices,
  paymentAllocations,
  paymentParts,
} from '../db/schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type CustomerListFilters = {
  area?: string;
  outstandingOnly?: string;
  query?: string;
  route?: string;
  routeName?: string;
  search?: string;
};

@Injectable()
export class CustomersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(filters: CustomerListFilters = {}) {
    const customerRows = await this.databaseService.db
      .select()
      .from(customers)
      .orderBy(desc(customers.createdAt));
    const invoiceRows = await this.databaseService.db.select().from(invoices);
    const allocationRows = await this.databaseService.db
      .select()
      .from(paymentAllocations);
    const paymentPartRows = await this.databaseService.db
      .select()
      .from(paymentParts);

    const searchQuery = filters.search?.trim() || filters.query?.trim() || '';
    const selectedArea = filters.area?.trim() ?? '';
    const selectedRoute =
      filters.routeName?.trim() || filters.route?.trim() || '';
    const outstandingOnly = filters.outstandingOnly === 'true';
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
      const customerInvoices =
        invoicesByCustomerId.get(invoice.customerId) ?? [];
      customerInvoices.push(invoice);
      invoicesByCustomerId.set(invoice.customerId, customerInvoices);
    }

    for (const allocation of allocationRows) {
      const invoiceAllocations =
        allocationsByInvoiceId.get(allocation.invoiceId) ?? [];
      invoiceAllocations.push(allocation);
      allocationsByInvoiceId.set(allocation.invoiceId, invoiceAllocations);
    }

    return customerRows
      .map((customer) => {
        const customerInvoices = invoicesByCustomerId.get(customer.id) ?? [];
        let totalInvoicedCents = 0;
        let totalPaidCents = 0;
        let unpaidInvoiceCount = 0;

        for (const invoice of customerInvoices) {
          const invoiceAmountCents = this.toCents(invoice.amount);
          const activePaidCents = this.getActivePaidCents(
            allocationsByInvoiceId.get(invoice.id) ?? [],
            paymentPartById,
          );

          totalInvoicedCents += invoiceAmountCents;
          totalPaidCents += activePaidCents;

          if (activePaidCents < invoiceAmountCents) {
            unpaidInvoiceCount += 1;
          }
        }

        return {
          customer,
          summary: {
            totalInvoiced: this.fromCents(totalInvoicedCents),
            totalPaid: this.fromCents(totalPaidCents),
            totalOutstanding: this.fromCents(
              totalInvoicedCents - totalPaidCents,
            ),
            unpaidInvoiceCount,
          },
        };
      })
      .filter((row) => {
        const customer = row.customer;
        const matchesSearch =
          !searchQuery ||
          this.includesSearch(customer.name, searchQuery) ||
          this.includesSearch(customer.code, searchQuery);
        const matchesArea = !selectedArea || customer.area === selectedArea;
        const matchesRoute =
          !selectedRoute || customer.routeName === selectedRoute;
        const matchesOutstanding =
          !outstandingOnly || this.toCents(row.summary.totalOutstanding) > 0;

        return (
          matchesSearch && matchesArea && matchesRoute && matchesOutstanding
        );
      });
  }

  async create(dto: CreateCustomerDto) {
    const [customer] = await this.databaseService.db
      .insert(customers)
      .values({
        id: `cust_${crypto.randomUUID()}`,
        code: dto.code,
        name: dto.name,
        contactPerson: dto.contactPerson,
        ownerName: dto.ownerName,
        phone: dto.phone,
        whatsappNumber: dto.whatsappNumber,
        email: dto.email,
        address: dto.address,
        area: dto.area,
        routeName: dto.routeName,
        assignedSalesRep: dto.assignedSalesRep,
        assignedCollector: dto.assignedCollector,
        creditLimit: dto.creditLimit ?? '0',
        openingOutstanding: dto.openingOutstanding ?? '0',
        paymentTermsDays: dto.paymentTermsDays ?? 0,
        isActive: dto.isActive ?? true,
        createdAt: new Date(),
      })
      .returning();

    return customer;
  }

  async findOne(id: string) {
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    if (!customer) {
      return null;
    }

    const invoiceRows = await this.databaseService.db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, customer.id));
    const allocationRows = await this.databaseService.db
      .select()
      .from(paymentAllocations);
    const paymentPartRows = await this.databaseService.db
      .select()
      .from(paymentParts);
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

    let totalInvoicedCents = 0;
    let totalPaidCents = 0;
    let unpaidInvoiceCount = 0;
    const invoiceSummaries = invoiceRows
      .sort(
        (left, right) =>
          right.invoiceDate.getTime() - left.invoiceDate.getTime(),
      )
      .map((invoice) => {
        const invoiceAmountCents = this.toCents(invoice.amount);
        const invoiceAllocations = allocationsByInvoiceId.get(invoice.id) ?? [];
        const activePaidCents = this.getActivePaidCents(
          invoiceAllocations,
          paymentPartById,
        );
        const outstandingCents = invoiceAmountCents - activePaidCents;
        const displayStatus = this.getDisplayStatus(
          invoiceAmountCents,
          activePaidCents,
        );

        totalInvoicedCents += invoiceAmountCents;
        totalPaidCents += activePaidCents;

        if (displayStatus === 'UNPAID' || displayStatus === 'PARTIALLY_PAID') {
          unpaidInvoiceCount += 1;
        }

        return {
          invoice,
          activePaidAmount: this.fromCents(activePaidCents),
          outstanding: this.fromCents(outstandingCents),
          displayStatus,
        };
      });

    return {
      customer,
      summary: {
        totalInvoiced: this.fromCents(totalInvoicedCents),
        totalPaid: this.fromCents(totalPaidCents),
        totalOutstanding: this.fromCents(totalInvoicedCents - totalPaidCents),
        unpaidInvoiceCount,
      },
      invoices: invoiceSummaries,
    };
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const [customer] = await this.databaseService.db
      .update(customers)
      .set(dto)
      .where(eq(customers.id, id))
      .returning();

    return customer ?? null;
  }

  async remove(id: string) {
    const [customer] = await this.databaseService.db
      .delete(customers)
      .where(eq(customers.id, id))
      .returning();

    return customer ?? null;
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

  private toCents(value: string | number) {
    const text = String(value);
    const sign = text.startsWith('-') ? -1 : 1;
    const [wholePart, fractionPart = ''] = text.replace('-', '').split('.');
    const wholeCents = Number(wholePart || '0') * 100;
    const fractionCents = Number(fractionPart.padEnd(2, '0').slice(0, 2));

    return sign * (wholeCents + fractionCents);
  }

  private includesSearch(value: string | null | undefined, query: string) {
    return value?.toLowerCase().includes(query.toLowerCase()) ?? false;
  }

  private fromCents(value: number) {
    const sign = value < 0 ? '-' : '';
    const absoluteValue = Math.abs(value);
    const whole = Math.floor(absoluteValue / 100);
    const fraction = String(absoluteValue % 100).padStart(2, '0');

    return `${sign}${whole}.${fraction}`;
  }
}
