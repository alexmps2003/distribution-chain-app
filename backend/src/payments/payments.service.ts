import {
  BadRequestException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  invoices,
  paymentAllocations,
  paymentParts,
  payments,
} from '../db/schema';
import { DatabaseService } from '../database/database.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  private sumMoney(values: string[]): number {
    return values.reduce((sum, value) => sum + this.toCents(value), 0);
  }

  async findAll() {
    const paymentRows = await this.databaseService.db.select().from(payments);
    const partRows = await this.databaseService.db.select().from(paymentParts);
    const allocationRows = await this.databaseService.db
      .select()
      .from(paymentAllocations);

    return paymentRows.map((payment) => ({
      ...payment,
      parts: partRows.filter((part) => part.paymentId === payment.id),
      allocations: allocationRows.filter(
        (allocation) => allocation.paymentId === payment.id,
      ),
    }));
  }

  async findOne(id: string) {
    const [payment] = await this.databaseService.db
      .select()
      .from(payments)
      .where(eq(payments.id, id));

    if (!payment) {
      return null;
    }

    const parts = await this.databaseService.db
      .select()
      .from(paymentParts)
      .where(eq(paymentParts.paymentId, id));
    const allocations = await this.databaseService.db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, id));

    return {
      ...payment,
      parts,
      allocations,
    };
  }

  async create(dto: CreatePaymentDto) {
    const paymentAmount = this.toCents(dto.amount);

    if (paymentAmount <= 0) {
      throw new BadRequestException('Payment total must be greater than 0');
    }

    if (!Array.isArray(dto.methods) || dto.methods.length === 0) {
      throw new BadRequestException('Payment method is required');
    }

    for (const method of dto.methods) {
      const methodAmount = this.toCents(method.amount);

      if (methodAmount <= 0) {
        throw new BadRequestException('Payment method amount must be greater than 0');
      }

      const methodAllocationTotal = this.sumMoney(
        (method.allocations ?? []).map((allocation) => allocation.amount),
      );

      if (methodAmount !== methodAllocationTotal) {
        throw new BadRequestException(
          'Payment method amount must equal method allocation total',
        );
      }

      if (method.method === 'CHEQUE') {
        if (!method.chequeNumber?.trim()) {
          throw new BadRequestException('Cheque number is required');
        }

        if (!method.chequeBank?.trim()) {
          throw new BadRequestException('Cheque bank is required');
        }

        if (!method.chequeDate?.trim()) {
          throw new BadRequestException('Cheque date is required');
        }
      }
    }

    const methodTotal = this.sumMoney(dto.methods.map((method) => method.amount));

    if (paymentAmount !== methodTotal) {
      throw new BadRequestException('Payment amount must equal payment method total');
    }

    const allocationTotal = this.sumMoney(
      dto.methods.flatMap((method) =>
        (method.allocations ?? []).map((allocation) => allocation.amount),
      ),
    );

    if (paymentAmount !== allocationTotal) {
      throw new BadRequestException('Payment amount must equal allocation total');
    }

    return this.databaseService.db.transaction(async (tx) => {
      const paymentMethod =
        dto.methods.length === 1 ? dto.methods[0].method : 'MIXED';
      const [payment] = await tx
        .insert(payments)
        .values({
          id: `pay_${crypto.randomUUID()}`,
          customerId: dto.customerId,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          amount: dto.amount,
          paymentMethod,
          notes: dto.notes,
          createdAt: new Date(),
        })
        .returning();

      const parts: (typeof paymentParts.$inferSelect)[] = [];
      const allocations: (typeof paymentAllocations.$inferSelect)[] = [];

      for (const method of dto.methods) {
        const [part] = await tx
          .insert(paymentParts)
          .values({
            id: `part_${crypto.randomUUID()}`,
            paymentId: payment.id,
            method: method.method,
            amount: method.amount,
            chequeNumber: method.chequeNumber,
            chequeBank: method.chequeBank,
            chequeDate: method.chequeDate ? new Date(method.chequeDate) : null,
            bankReference: method.bankReference,
            cardReference: method.cardReference,
          })
          .returning();

        parts.push(part);

        for (const allocation of method.allocations ?? []) {
          const [invoice] = await tx
            .select()
            .from(invoices)
            .where(eq(invoices.id, allocation.invoiceId));

          if (!invoice) {
            throw new BadRequestException('Selected invoice could not be found');
          }

          if (invoice.customerId !== dto.customerId) {
            throw new BadRequestException(
              'Selected invoice does not belong to customer',
            );
          }

          const existingAllocations = await tx
            .select()
            .from(paymentAllocations)
            .where(eq(paymentAllocations.invoiceId, allocation.invoiceId));

          const allocatedTotal = await this.getActiveAllocationTotal(
            tx,
            existingAllocations,
          );
          const outstanding = this.toCents(invoice.amount) - allocatedTotal;

          if (this.toCents(allocation.amount) > outstanding) {
            throw new BadRequestException(
              'Allocation exceeds invoice outstanding balance',
            );
          }

          const [createdAllocation] = await tx
            .insert(paymentAllocations)
            .values({
              id: `alloc_${crypto.randomUUID()}`,
              paymentId: payment.id,
              paymentPartId: part.id,
              invoiceId: allocation.invoiceId,
              amount: allocation.amount,
            })
            .returning();

          allocations.push(createdAllocation);
        }
      }

      const affectedInvoiceIds = [
        ...new Set(allocations.map((allocation) => allocation.invoiceId)),
      ];

      for (const invoiceId of affectedInvoiceIds) {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(eq(invoices.id, invoiceId));

        if (!invoice) {
          continue;
        }

        const invoiceAllocations = await tx
          .select()
          .from(paymentAllocations)
          .where(eq(paymentAllocations.invoiceId, invoiceId));

        const paidTotal = await this.getActiveAllocationTotal(
          tx,
          invoiceAllocations,
        );

        const invoiceAmount = this.toCents(invoice.amount);
        const status =
          paidTotal >= invoiceAmount
            ? 'PAID'
            : paidTotal > 0
              ? 'PARTIALLY_PAID'
              : 'UNPAID';

        await tx
          .update(invoices)
          .set({ status })
          .where(eq(invoices.id, invoiceId));
      }

      return {
        payment,
        parts,
        allocations,
      };
    });
  }

  private async getActiveAllocationTotal(
    tx: Parameters<
      Parameters<typeof this.databaseService.db.transaction>[0]
    >[0],
    allocations: (typeof paymentAllocations.$inferSelect)[],
  ) {
    let total = 0;

    for (const allocation of allocations) {
      if (!allocation.paymentPartId) {
        total += this.toCents(allocation.amount);
        continue;
      }

      const [part] = await tx
        .select()
        .from(paymentParts)
        .where(eq(paymentParts.id, allocation.paymentPartId));

      if (part?.status === 'ACTIVE') {
        total += this.toCents(allocation.amount);
      }
    }

    return total;
  }

  private toCents(value: string | number) {
    const text = String(value);
    const sign = text.startsWith('-') ? -1 : 1;
    const [wholePart, fractionPart = ''] = text.replace('-', '').split('.');
    const wholeCents = Number(wholePart || '0') * 100;
    const fractionCents = Number(fractionPart.padEnd(2, '0').slice(0, 2));

    return sign * (wholeCents + fractionCents);
  }

  async reverse(id: string) {
    throw new NotImplementedException(
      'Whole payment reversal is not implemented. Use /api/cheques/:id/reverse for cheque reversal.',
    );
  }
}
