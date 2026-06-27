import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
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

  async findAll() {
    return this.databaseService.db.select().from(invoices);
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
        status: dto.status ?? 'UNPAID',
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
