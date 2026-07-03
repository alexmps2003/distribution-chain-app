import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  customers,
  invoices,
  paymentAllocations,
  paymentParts,
  payments,
} from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsTemplateService } from '../notifications/sms-template.service';
import { ReverseChequeDto } from './dto/reverse-cheque.dto';

@Injectable()
export class ChequesService {
  private readonly logger = new Logger(ChequesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly smsTemplateService: SmsTemplateService,
  ) {}

  async findAll(filters: { bank?: string; query?: string; status?: string }) {
    const query = filters.query?.trim().toLowerCase() ?? '';
    const bank = filters.bank?.trim() ?? '';
    const status =
      filters.status === 'ACTIVE' || filters.status === 'REVERSED'
        ? filters.status
        : '';
    const chequeRows = await this.databaseService.db
      .select()
      .from(paymentParts)
      .where(eq(paymentParts.method, 'CHEQUE'))
      .orderBy(desc(paymentParts.chequeDate));
    const filteredChequeRows = chequeRows
      .filter((cheque) => {
        if (!query) {
          return true;
        }

        return cheque.chequeNumber?.toLowerCase().includes(query) ?? false;
      })
      .filter((cheque) => {
        if (!bank) {
          return true;
        }

        return cheque.chequeBank === bank;
      })
      .filter((cheque) => {
        if (!status) {
          return true;
        }

        return cheque.status === status;
      });

    return Promise.all(
      filteredChequeRows.map((cheque) =>
        this.withPaymentAndAllocations(cheque),
      ),
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

    const updatedCheque = await this.databaseService.db.transaction(
      async (tx) => {
        const [cheque] = await tx
          .select()
          .from(paymentParts)
          .where(
            and(eq(paymentParts.id, id), eq(paymentParts.method, 'CHEQUE')),
          );

        if (!cheque) {
          throw new NotFoundException('Cheque not found');
        }

        if (cheque.status === 'REVERSED') {
          throw new BadRequestException('Only active cheques can be reversed');
        }

        await this.linkLegacyAllocationsIfSafe(tx, cheque);

        const [updatedCheque] = await tx
          .update(paymentParts)
          .set({
            status: 'REVERSED',
            reversedAt: new Date(),
            reversalReason,
          })
          .where(eq(paymentParts.id, cheque.id))
          .returning();

        const chequeAllocations = await this.getChequeAllocations(
          tx,
          cheque.id,
        );

        const affectedInvoiceIds = [
          ...new Set(
            chequeAllocations.map((allocation) => allocation.invoiceId),
          ),
        ];

        await this.recalculateInvoiceStatuses(tx, affectedInvoiceIds);

        return updatedCheque;
      },
    );

    await this.sendChequeReversedSms(updatedCheque);

    return updatedCheque;
  }

  async undoReversal(id: string) {
    const updatedCheque = await this.databaseService.db.transaction(
      async (tx) => {
        const [cheque] = await tx
          .select()
          .from(paymentParts)
          .where(
            and(eq(paymentParts.id, id), eq(paymentParts.method, 'CHEQUE')),
          );

        if (!cheque) {
          throw new NotFoundException('Cheque not found');
        }

        if (cheque.status !== 'REVERSED') {
          throw new BadRequestException(
            'Only reversed cheques can be restored',
          );
        }

        await this.linkLegacyAllocationsIfSafe(tx, cheque);

        const [updatedCheque] = await tx
          .update(paymentParts)
          .set({
            status: 'ACTIVE',
            reversedAt: null,
            reversalReason: null,
          })
          .where(eq(paymentParts.id, cheque.id))
          .returning();

        const chequeAllocations = await this.getChequeAllocations(
          tx,
          cheque.id,
        );

        const affectedInvoiceIds = [
          ...new Set(
            chequeAllocations.map((allocation) => allocation.invoiceId),
          ),
        ];

        await this.recalculateInvoiceStatuses(tx, affectedInvoiceIds);

        return updatedCheque;
      },
    );

    await this.sendChequeReversalUndoneSms(updatedCheque);

    return updatedCheque;
  }

  private async linkLegacyAllocationsIfSafe(
    tx: Parameters<
      Parameters<typeof this.databaseService.db.transaction>[0]
    >[0],
    cheque: typeof paymentParts.$inferSelect,
  ) {
    const unlinkedAllocations = await tx
      .select()
      .from(paymentAllocations)
      .where(
        and(
          eq(paymentAllocations.paymentId, cheque.paymentId),
          isNull(paymentAllocations.paymentPartId),
        ),
      );

    if (unlinkedAllocations.length === 0) {
      return;
    }

    const paymentPartRows = await tx
      .select()
      .from(paymentParts)
      .where(eq(paymentParts.paymentId, cheque.paymentId));

    if (paymentPartRows.length !== 1 || paymentPartRows[0]?.id !== cheque.id) {
      throw new BadRequestException(
        'Cheque allocations could not be matched to this cheque',
      );
    }

    await tx
      .update(paymentAllocations)
      .set({ paymentPartId: cheque.id })
      .where(
        and(
          eq(paymentAllocations.paymentId, cheque.paymentId),
          isNull(paymentAllocations.paymentPartId),
        ),
      );
  }

  private async getChequeAllocations(
    tx: Parameters<
      Parameters<typeof this.databaseService.db.transaction>[0]
    >[0],
    chequeId: string,
  ) {
    return tx
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentPartId, chequeId));
  }

  private async recalculateInvoiceStatuses(
    tx: Parameters<
      Parameters<typeof this.databaseService.db.transaction>[0]
    >[0],
    invoiceIds: string[],
  ) {
    if (invoiceIds.length === 0) {
      return;
    }

    const paymentPartRows = await tx.select().from(paymentParts);
    const paymentPartById = new Map(
      paymentPartRows.map((paymentPart) => [paymentPart.id, paymentPart]),
    );

    for (const invoiceId of invoiceIds) {
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
      const activePaidTotal = this.getActivePaidCents(
        invoiceAllocations,
        paymentPartById,
      );
      const invoiceAmount = this.toCents(invoice.amount);
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
  }

  private async sendChequeReversedSms(
    cheque: typeof paymentParts.$inferSelect,
  ) {
    try {
      const [payment] = await this.databaseService.db
        .select()
        .from(payments)
        .where(eq(payments.id, cheque.paymentId));

      if (!payment) {
        return;
      }

      const [customer] = await this.databaseService.db
        .select()
        .from(customers)
        .where(eq(customers.id, payment.customerId));
      const phoneNumber = customer?.phone?.trim();

      if (!customer || !phoneNumber) {
        return;
      }

      const outstanding = await this.getCustomerOutstanding(customer.id);
      const message = this.smsTemplateService.chequeReversed({
        amount: cheque.amount,
        chequeNumber: cheque.chequeNumber ?? 'N/A',
        customerName: customer.name,
        dateTime: cheque.reversedAt,
        outstanding,
        reason: cheque.reversalReason,
      });

      await this.notificationsService.sendSms(phoneNumber, message);
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? `Cheque reversal SMS notification failed: ${error.message}`
          : 'Cheque reversal SMS notification failed',
      );
    }
  }

  private async sendChequeReversalUndoneSms(
    cheque: typeof paymentParts.$inferSelect,
  ) {
    try {
      const [payment] = await this.databaseService.db
        .select()
        .from(payments)
        .where(eq(payments.id, cheque.paymentId));

      if (!payment) {
        return;
      }

      const [customer] = await this.databaseService.db
        .select()
        .from(customers)
        .where(eq(customers.id, payment.customerId));
      const phoneNumber = customer?.phone?.trim();

      if (!customer || !phoneNumber) {
        return;
      }

      const outstanding = await this.getCustomerOutstanding(customer.id);
      const message = this.smsTemplateService.chequeReversalUndone({
        amount: cheque.amount,
        chequeNumber: cheque.chequeNumber ?? 'N/A',
        customerName: customer.name,
        dateTime: new Date(),
        outstanding,
      });

      await this.notificationsService.sendSms(phoneNumber, message);
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? `Cheque reversal undo SMS notification failed: ${error.message}`
          : 'Cheque reversal undo SMS notification failed',
      );
    }
  }

  private async getCustomerOutstanding(customerId: string) {
    const customerInvoices = await this.databaseService.db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, customerId));
    const paymentPartRows = await this.databaseService.db
      .select()
      .from(paymentParts);
    const paymentPartById = new Map(
      paymentPartRows.map((paymentPart) => [paymentPart.id, paymentPart]),
    );
    let outstandingCents = 0;

    for (const invoice of customerInvoices) {
      const allocationRows = await this.databaseService.db
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.invoiceId, invoice.id));
      const activePaidCents = this.getActivePaidCents(
        allocationRows,
        paymentPartById,
      );

      outstandingCents += Math.max(
        this.toCents(invoice.amount) - activePaidCents,
        0,
      );
    }

    return this.fromCents(outstandingCents);
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

      if (this.isActivePaymentPart(paymentPart)) {
        return sum + this.toCents(allocation.amount);
      }

      return sum;
    }, 0);
  }

  private isActivePaymentPart(paymentPart?: typeof paymentParts.$inferSelect) {
    return Boolean(paymentPart && paymentPart.status !== 'REVERSED');
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
