import { Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import {
  customers,
  invoices,
  paymentAllocations,
  paymentParts,
  payments,
} from '../db/schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(customerId?: string) {
    const customerRows = await this.databaseService.db
      .select()
      .from(customers)
      .orderBy(asc(customers.name));
    const invoiceRows = await this.databaseService.db.select().from(invoices);
    const allocationRows = await this.databaseService.db
      .select()
      .from(paymentAllocations);
    const paymentPartRows = await this.databaseService.db
      .select()
      .from(paymentParts);

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

    if (customerId) {
      const customer = customerRows.find((row) => row.id === customerId);

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const customerInvoices = (invoicesByCustomerId.get(customer.id) ?? [])
        .map((invoice) =>
          this.buildCalculatedInvoiceRow(
            invoice,
            allocationsByInvoiceId,
            paymentPartById,
          ),
        )
        .sort(
          (left, right) =>
            right.invoice.createdAt.getTime() - left.invoice.createdAt.getTime(),
        );

      return {
        customer,
        invoices: customerInvoices,
      };
    }

    return customerRows.map((customer) => {
      const customerInvoices = invoicesByCustomerId.get(customer.id) ?? [];
      const calculatedInvoices = customerInvoices.map((invoice) =>
        this.buildCalculatedInvoiceRow(
          invoice,
          allocationsByInvoiceId,
          paymentPartById,
        ),
      );
      const totalInvoicedCents = calculatedInvoices.reduce(
        (sum, invoice) => sum + this.toCents(invoice.invoice.amount),
        0,
      );
      const totalPaidCents = calculatedInvoices.reduce(
        (sum, invoice) => sum + this.toCents(invoice.activePaidAmount),
        0,
      );

      return {
        customer,
        invoiceCount: calculatedInvoices.length,
        totalInvoiced: this.fromCents(totalInvoicedCents),
        totalPaid: this.fromCents(totalPaidCents),
        totalOutstanding: this.fromCents(totalInvoicedCents - totalPaidCents),
        calculatedStatusSummary: calculatedInvoices.reduce(
          (summary, invoice) => {
            summary[invoice.displayStatus] += 1;
            return summary;
          },
          {
            PAID: 0,
            PARTIALLY_PAID: 0,
            UNPAID: 0,
          },
        ),
      };
    });
  }

  async create(dto: CreateInvoiceDto) {
    const [invoice] = await this.databaseService.db
      .insert(invoices)
      .values({
        id: `inv_${crypto.randomUUID()}`,
        invoiceNumber: dto.invoiceNumber,
        amount: dto.amount,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: 'UNPAID',
        customerId: dto.customerId,
        createdAt: new Date(),
      })
      .returning();

    return invoice;
  }

  async findOne(id: string) {
    const [invoice] = await this.databaseService.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));

    if (!invoice) {
      return null;
    }

    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, invoice.customerId));
    const allocationRows = await this.databaseService.db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoice.id));
    const paymentRows = await this.databaseService.db.select().from(payments);
    const paymentPartRows = await this.databaseService.db
      .select()
      .from(paymentParts);
    const paymentById = new Map(
      paymentRows.map((payment) => [payment.id, payment]),
    );
    const paymentPartById = new Map(
      paymentPartRows.map((paymentPart) => [paymentPart.id, paymentPart]),
    );
    let activePaidCents = 0;
    const allocations = allocationRows.map((allocation) => {
      const paymentPart = allocation.paymentPartId
        ? (paymentPartById.get(allocation.paymentPartId) ?? null)
        : null;

      if (!paymentPart || paymentPart.status === 'ACTIVE') {
        activePaidCents += this.toCents(allocation.amount);
      }

      return {
        ...allocation,
        payment: paymentById.get(allocation.paymentId) ?? null,
        paymentPart,
      };
    });
    const invoiceAmountCents = this.toCents(invoice.amount);
    const outstandingCents = invoiceAmountCents - activePaidCents;

    return {
      invoice,
      customer: customer ?? null,
      allocations,
      activePaidAmount: this.fromCents(activePaidCents),
      outstanding: this.fromCents(outstandingCents),
      displayStatus: this.getDisplayStatus(invoiceAmountCents, activePaidCents),
    };
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const [invoice] = await this.databaseService.db
      .update(invoices)
      .set({
        ...dto,
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      })
      .where(eq(invoices.id, id))
      .returning();

    return invoice ?? null;
  }

  async remove(id: string) {
    const [invoice] = await this.databaseService.db
      .delete(invoices)
      .where(eq(invoices.id, id))
      .returning();

    return invoice ?? null;
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

  private buildCalculatedInvoiceRow(
    invoice: typeof invoices.$inferSelect,
    allocationsByInvoiceId: Map<
      string,
      (typeof paymentAllocations.$inferSelect)[]
    >,
    paymentPartById: Map<string, typeof paymentParts.$inferSelect>,
  ) {
    const activePaidCents = (allocationsByInvoiceId.get(invoice.id) ?? []).reduce(
      (sum, allocation) => {
        if (!allocation.paymentPartId) {
          return sum + this.toCents(allocation.amount);
        }

        const paymentPart = paymentPartById.get(allocation.paymentPartId);

        if (paymentPart?.status === 'ACTIVE') {
          return sum + this.toCents(allocation.amount);
        }

        return sum;
      },
      0,
    );
    const invoiceAmountCents = this.toCents(invoice.amount);

    return {
      invoice,
      activePaidAmount: this.fromCents(activePaidCents),
      outstanding: this.fromCents(invoiceAmountCents - activePaidCents),
      displayStatus: this.getDisplayStatus(invoiceAmountCents, activePaidCents),
    };
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
