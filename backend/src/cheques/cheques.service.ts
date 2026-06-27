import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  customers,
  invoices,
  paymentAllocations,
  paymentParts,
  payments,
} from '../db/schema';
import { ReverseChequeDto } from './dto/reverse-cheque.dto';

@Injectable()
export class ChequesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const chequeRows = await this.databaseService.db
      .select()
      .from(paymentParts)
      .where(eq(paymentParts.method, 'CHEQUE'))
      .orderBy(desc(paymentParts.chequeDate));

    return Promise.all(
      chequeRows.map((cheque) => this.withPaymentAndAllocations(cheque)),
    );
  }

  async findOne(id: string) {
    const [cheque] = await this.databaseService.db
      .select()
      .from(paymentParts)
      .where(and(eq(paymentParts.id, id), eq(paymentParts.method, 'CHEQUE')));

    if (!cheque) {
      return null;
    }

    return this.withPaymentAndAllocations(cheque);
  }

  async reverse(id: string, dto: ReverseChequeDto) {
    const reversalReason = dto.reversalReason?.trim();

    if (!reversalReason) {
      throw new BadRequestException('Reversal reason is required');
    }

    return this.databaseService.db.transaction(async (tx) => {
      const [cheque] = await tx
        .select()
        .from(paymentParts)
        .where(eq(paymentParts.id, id));

      if (!cheque) {
        throw new NotFoundException('Cheque not found');
      }

      if (cheque.method !== 'CHEQUE') {
        throw new BadRequestException(
          'Only cheque payment parts can be reversed here',
        );
      }

      if (cheque.status !== 'ACTIVE') {
        throw new BadRequestException('Only active cheques can be reversed');
      }

      const [updatedCheque] = await tx
        .update(paymentParts)
        .set({
          status: 'REVERSED',
          reversedAt: new Date(),
          reversalReason,
        })
        .where(eq(paymentParts.id, cheque.id))
        .returning();

      const chequeAllocations = await tx
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentPartId, cheque.id));

      const affectedInvoiceIds = [
        ...new Set(chequeAllocations.map((allocation) => allocation.invoiceId)),
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

        let activePaidTotal = 0;

        for (const allocation of invoiceAllocations) {
          if (!allocation.paymentPartId) {
            activePaidTotal += Number(allocation.amount);
            continue;
          }

          const [part] = await tx
            .select()
            .from(paymentParts)
            .where(eq(paymentParts.id, allocation.paymentPartId));

          if (part?.status === 'ACTIVE') {
            activePaidTotal += Number(allocation.amount);
          }
        }

        const invoiceAmount = Number(invoice.amount);
        const status =
          activePaidTotal >= invoiceAmount
            ? 'PAID'
            : activePaidTotal > 0
              ? 'PARTIALLY_PAID'
              : 'UNPAID';

        await tx
          .update(invoices)
          .set({ status })
          .where(eq(invoices.id, invoiceId));
      }

      return updatedCheque;
    });
  }

  async undoReversal(id: string) {
    return this.databaseService.db.transaction(async (tx) => {
      const [cheque] = await tx
        .select()
        .from(paymentParts)
        .where(eq(paymentParts.id, id));

      if (!cheque) {
        throw new NotFoundException('Cheque not found');
      }

      if (cheque.method !== 'CHEQUE') {
        throw new BadRequestException(
          'Only cheque payment parts can be restored here',
        );
      }

      if (cheque.status !== 'REVERSED') {
        throw new BadRequestException('Only reversed cheques can be restored');
      }

      const [updatedCheque] = await tx
        .update(paymentParts)
        .set({
          status: 'ACTIVE',
          reversedAt: null,
          reversalReason: null,
        })
        .where(eq(paymentParts.id, cheque.id))
        .returning();

      const chequeAllocations = await tx
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentPartId, cheque.id));

      const affectedInvoiceIds = [
        ...new Set(chequeAllocations.map((allocation) => allocation.invoiceId)),
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

        let activePaidTotal = 0;

        for (const allocation of invoiceAllocations) {
          if (!allocation.paymentPartId) {
            activePaidTotal += Number(allocation.amount);
            continue;
          }

          const [part] = await tx
            .select()
            .from(paymentParts)
            .where(eq(paymentParts.id, allocation.paymentPartId));

          if (part?.status === 'ACTIVE') {
            activePaidTotal += Number(allocation.amount);
          }
        }

        const invoiceAmount = Number(invoice.amount);
        const status =
          activePaidTotal >= invoiceAmount
            ? 'PAID'
            : activePaidTotal > 0
              ? 'PARTIALLY_PAID'
              : 'UNPAID';

        await tx
          .update(invoices)
          .set({ status })
          .where(eq(invoices.id, invoiceId));
      }

      return updatedCheque;
    });
  }

  private async withPaymentAndAllocations(
    cheque: typeof paymentParts.$inferSelect,
  ) {
    const [payment] = await this.databaseService.db
      .select()
      .from(payments)
      .where(eq(payments.id, cheque.paymentId));

    const [customer] = payment
      ? await this.databaseService.db
          .select()
          .from(customers)
          .where(eq(customers.id, payment.customerId))
      : [];

    const allocationRows = await this.databaseService.db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentPartId, cheque.id));

    const allocations = await Promise.all(
      allocationRows.map(async (allocation) => {
        const [invoice] = await this.databaseService.db
          .select()
          .from(invoices)
          .where(eq(invoices.id, allocation.invoiceId));

        return {
          ...allocation,
          invoice: invoice ?? null,
        };
      }),
    );

    return {
      ...cheque,
      payment: payment ? { ...payment, customer: customer ?? null } : null,
      allocations,
    };
  }
}
