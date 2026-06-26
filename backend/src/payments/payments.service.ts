import { BadRequestException, Injectable } from '@nestjs/common';
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
    return values.reduce((sum, value) => sum + Number(value), 0);
  }

  async create(dto: CreatePaymentDto) {
    const methodTotal = this.sumMoney(dto.methods.map((method) => method.amount));

    if (Number(dto.amount) !== methodTotal) {
      throw new BadRequestException('Payment amount must equal payment method total');
    }

    const allocationTotal = this.sumMoney(
      dto.methods.flatMap((method) =>
        (method.allocations ?? []).map((allocation) => allocation.amount),
      ),
    );

    if (Number(dto.amount) !== allocationTotal) {
      throw new BadRequestException('Payment amount must equal allocation total');
    }

    return this.databaseService.db.transaction(async (tx) => {
      const [payment] = await tx
        .insert(payments)
        .values({
          id: `pay_${crypto.randomUUID()}`,
          customerId: dto.customerId,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
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

        const paidTotal = invoiceAllocations.reduce(
          (sum, allocation) => sum + Number(allocation.amount),
          0,
        );

        const invoiceAmount = Number(invoice.amount);
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
}
