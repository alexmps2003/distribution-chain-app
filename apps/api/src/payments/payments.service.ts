import {
  BadRequestException,
  Injectable,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  customers,
  invoices,
  paymentAllocations,
  paymentParts,
  payments,
} from '../db/schema';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsTemplateService } from '../notifications/sms-template.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { parsePositiveMoneyToCents } from './payment-amount';

type PaymentListFilters = {
  from?: string;
  method?: string;
  month?: string;
  query?: string;
  search?: string;
  to?: string;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly smsTemplateService: SmsTemplateService,
  ) {}

  private sumMoney(values: string[]): number {
    return values.reduce((sum, value) => sum + this.toCents(value), 0);
  }

  async findAll(filters: PaymentListFilters = {}) {
    const paymentRows = await this.databaseService.db.select().from(payments);
    const partRows = await this.databaseService.db.select().from(paymentParts);
    const allocationRows = await this.databaseService.db
      .select()
      .from(paymentAllocations);
    const customerRows = await this.databaseService.db.select().from(customers);
    const customerById = new Map(
      customerRows.map((customer) => [customer.id, customer]),
    );
    const partsByPaymentId = new Map<
      string,
      (typeof paymentParts.$inferSelect)[]
    >();
    const allocationsByPaymentId = new Map<
      string,
      (typeof paymentAllocations.$inferSelect)[]
    >();

    for (const part of partRows) {
      const paymentPartsForPayment = partsByPaymentId.get(part.paymentId) ?? [];
      paymentPartsForPayment.push(part);
      partsByPaymentId.set(part.paymentId, paymentPartsForPayment);
    }

    for (const allocation of allocationRows) {
      const paymentAllocationsForPayment =
        allocationsByPaymentId.get(allocation.paymentId) ?? [];
      paymentAllocationsForPayment.push(allocation);
      allocationsByPaymentId.set(
        allocation.paymentId,
        paymentAllocationsForPayment,
      );
    }

    const searchQuery = filters.search?.trim() || filters.query?.trim() || '';
    const selectedMethod = this.getSelectedMethod(filters.method);
    const monthRange = this.getMonthRange(filters.month);
    const fromDate = monthRange?.start ?? this.getDateFromParam(filters.from);
    const toDate = monthRange
      ? monthRange.end
      : this.getDateFromParam(filters.to, true);

    return paymentRows
      .map((payment) => {
        const parts = partsByPaymentId.get(payment.id) ?? [];

        return {
          ...payment,
          customer: customerById.get(payment.customerId) ?? null,
          parts,
          allocations: allocationsByPaymentId.get(payment.id) ?? [],
        };
      })
      .filter((payment) => {
        if (!selectedMethod) {
          return true;
        }

        if (selectedMethod === 'MIXED') {
          return payment.paymentMethod === 'MIXED';
        }

        return (
          payment.paymentMethod === selectedMethod ||
          payment.parts.some((part) => part.method === selectedMethod)
        );
      })
      .filter((payment) => {
        if (!searchQuery) {
          return true;
        }

        return (
          this.includesSearch(payment.id, searchQuery) ||
          this.includesSearch(payment.customer?.name, searchQuery) ||
          this.includesSearch(payment.customer?.code, searchQuery) ||
          this.includesSearch(
            this.formatPaymentReference(payment),
            searchQuery,
          ) ||
          payment.parts.some((part) => {
            return (
              this.includesSearch(part.chequeNumber, searchQuery) ||
              this.includesSearch(part.bankReference, searchQuery) ||
              this.includesSearch(part.cardReference, searchQuery)
            );
          })
        );
      })
      .filter((payment) => {
        if (fromDate && payment.paymentDate < fromDate) {
          return false;
        }

        if (toDate) {
          return monthRange
            ? payment.paymentDate < toDate
            : payment.paymentDate <= toDate;
        }

        return true;
      })
      .sort((left, right) => {
        const createdDifference =
          right.createdAt.getTime() - left.createdAt.getTime();

        if (createdDifference !== 0) {
          return createdDifference;
        }

        return right.paymentDate.getTime() - left.paymentDate.getTime();
      });
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
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, payment.customerId));
    const invoiceIds = new Set(
      allocations.map((allocation) => allocation.invoiceId),
    );
    const invoiceRows = await this.databaseService.db.select().from(invoices);
    const invoiceById = new Map(
      invoiceRows
        .filter((invoice) => invoiceIds.has(invoice.id))
        .map((invoice) => [invoice.id, invoice]),
    );
    const paymentPartById = new Map(parts.map((part) => [part.id, part]));

    return {
      payment,
      receiptReference: this.formatPaymentReference(payment),
      customer: customer ?? null,
      parts,
      allocations: allocations.map((allocation) => ({
        ...allocation,
        invoice: invoiceById.get(allocation.invoiceId) ?? null,
        paymentPart: allocation.paymentPartId
          ? (paymentPartById.get(allocation.paymentPartId) ?? null)
          : null,
      })),
    };
  }

  async create(dto: CreatePaymentDto) {
    const paymentAmount = this.toCents(dto.amount);
    const requestedAllocationCentsByInvoiceId = new Map<string, number>();

    if (paymentAmount <= 0) {
      throw new BadRequestException('Payment total must be greater than 0');
    }

    if (!Array.isArray(dto.methods) || dto.methods.length === 0) {
      throw new BadRequestException('Payment method is required');
    }

    for (const method of dto.methods) {
      const methodAmount = this.toCents(method.amount);

      if (methodAmount <= 0) {
        throw new BadRequestException(
          'Payment method amount must be greater than 0',
        );
      }

      let methodAllocationTotal = 0;

      for (const allocation of method.allocations ?? []) {
        const allocationCents = parsePositiveMoneyToCents(allocation.amount);

        if (allocationCents === null) {
          throw new BadRequestException(
            'Allocation amount must be greater than 0 with at most 2 decimal places',
          );
        }

        methodAllocationTotal += allocationCents;
        requestedAllocationCentsByInvoiceId.set(
          allocation.invoiceId,
          (requestedAllocationCentsByInvoiceId.get(allocation.invoiceId) ?? 0) +
            allocationCents,
        );
      }

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

    const methodTotal = this.sumMoney(
      dto.methods.map((method) => method.amount),
    );

    if (paymentAmount !== methodTotal) {
      throw new BadRequestException(
        'Payment amount must equal payment method total',
      );
    }

    const allocationTotal = [
      ...requestedAllocationCentsByInvoiceId.values(),
    ].reduce((total, amount) => total + amount, 0);

    if (paymentAmount !== allocationTotal) {
      throw new BadRequestException(
        'Payment amount must equal allocation total',
      );
    }

    const createdPayment = await this.databaseService.db.transaction(
      async (tx) => {
        const invoiceIds = [
          ...requestedAllocationCentsByInvoiceId.keys(),
        ].sort();
        const lockedInvoiceById = await this.lockInvoicesForPayment(
          tx,
          invoiceIds,
          dto.customerId,
        );

        const paymentMethod =
          dto.methods.length === 1 ? dto.methods[0].method : 'MIXED';
        const [payment] = await tx
          .insert(payments)
          .values({
            id: `pay_${crypto.randomUUID()}`,
            customerId: dto.customerId,
            paymentDate: dto.paymentDate
              ? new Date(dto.paymentDate)
              : new Date(),
            amount: dto.amount,
            paymentMethod,
            notes: dto.notes,
            createdAt: new Date(),
          })
          .returning();

        const parts: (typeof paymentParts.$inferSelect)[] = [];
        const allocations: (typeof paymentAllocations.$inferSelect)[] = [];
        const partByMethodIndex = new Map<
          number,
          typeof paymentParts.$inferSelect
        >();

        for (const [methodIndex, method] of dto.methods.entries()) {
          const [part] = await tx
            .insert(paymentParts)
            .values({
              id: `part_${crypto.randomUUID()}`,
              paymentId: payment.id,
              method: method.method,
              amount: method.amount,
              chequeNumber: method.chequeNumber,
              chequeBank: method.chequeBank,
              chequeDate: method.chequeDate
                ? new Date(method.chequeDate)
                : null,
              bankReference: method.bankReference,
              cardReference: method.cardReference,
            })
            .returning();

          parts.push(part);
          partByMethodIndex.set(methodIndex, part);
        }

        for (const invoiceId of invoiceIds) {
          const invoice = lockedInvoiceById.get(invoiceId);

          if (!invoice) {
            throw new BadRequestException(
              'Selected invoice could not be found',
            );
          }

          const existingAllocations = await tx
            .select()
            .from(paymentAllocations)
            .where(eq(paymentAllocations.invoiceId, invoiceId));

          const allocatedTotal = await this.getActiveAllocationTotal(
            tx,
            existingAllocations,
          );
          const outstanding = this.toCents(invoice.amount) - allocatedTotal;
          const requestedAllocation =
            requestedAllocationCentsByInvoiceId.get(invoiceId) ?? 0;

          if (requestedAllocation > outstanding) {
            throw new BadRequestException(
              'Allocation exceeds invoice outstanding balance',
            );
          }
        }

        for (const [methodIndex, method] of dto.methods.entries()) {
          const part = partByMethodIndex.get(methodIndex);

          if (!part) {
            throw new BadRequestException(
              'Payment method could not be created',
            );
          }

          for (const allocation of method.allocations ?? []) {
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
          const invoice = lockedInvoiceById.get(invoiceId);

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
      },
    );

    await this.sendPaymentReceivedSms(createdPayment.payment.customerId, {
      amount: createdPayment.payment.amount,
    });

    return createdPayment;
  }

  private async lockInvoicesForPayment(
    tx: Parameters<
      Parameters<typeof this.databaseService.db.transaction>[0]
    >[0],
    invoiceIds: string[],
    customerId: string,
  ) {
    const lockedInvoiceById = new Map<string, typeof invoices.$inferSelect>();

    for (const invoiceId of [...new Set(invoiceIds)].sort()) {
      const invoice = await this.lockInvoiceForUpdate(tx, invoiceId);

      if (!invoice) {
        throw new BadRequestException('Selected invoice could not be found');
      }

      if (invoice.customerId !== customerId) {
        throw new BadRequestException(
          'Selected invoice does not belong to customer',
        );
      }

      lockedInvoiceById.set(invoiceId, invoice);
    }

    return lockedInvoiceById;
  }

  private async lockInvoiceForUpdate(
    tx: Parameters<
      Parameters<typeof this.databaseService.db.transaction>[0]
    >[0],
    invoiceId: string,
  ) {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .for('update');

    return invoice;
  }

  private async sendPaymentReceivedSms(
    customerId: string,
    payment: { amount: string | number },
  ) {
    try {
      const [customer] = await this.databaseService.db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId));

      const phoneNumber = customer?.phone?.trim();

      if (!phoneNumber) {
        return;
      }

      const outstanding = await this.getCustomerOutstanding(customer.id);
      const message = this.smsTemplateService.paymentReceived({
        amount: payment.amount,
        customerName: customer.name,
        outstanding,
      });

      await this.notificationsService.sendSms(phoneNumber, message);
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? `Payment SMS notification failed: ${error.message}`
          : 'Payment SMS notification failed',
      );
    }
  }

  private async getCustomerOutstanding(customerId: string) {
    const customerInvoices = await this.databaseService.db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, customerId));
    let outstandingCents = 0;

    for (const invoice of customerInvoices) {
      const allocationRows = await this.databaseService.db
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.invoiceId, invoice.id));
      const paidCents =
        await this.getActiveAllocationTotalForInvoice(allocationRows);

      outstandingCents += Math.max(this.toCents(invoice.amount) - paidCents, 0);
    }

    return this.fromCents(outstandingCents);
  }

  private async getActiveAllocationTotalForInvoice(
    allocations: (typeof paymentAllocations.$inferSelect)[],
  ) {
    let total = 0;

    for (const allocation of allocations) {
      if (!allocation.paymentPartId) {
        total += this.toCents(allocation.amount);
        continue;
      }

      const [part] = await this.databaseService.db
        .select()
        .from(paymentParts)
        .where(eq(paymentParts.id, allocation.paymentPartId));

      if (part?.status === 'ACTIVE') {
        total += this.toCents(allocation.amount);
      }
    }

    return total;
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

  private fromCents(value: number) {
    const sign = value < 0 ? '-' : '';
    const absoluteValue = Math.abs(value);
    const whole = Math.floor(absoluteValue / 100);
    const fraction = String(absoluteValue % 100).padStart(2, '0');

    return `${sign}${whole}.${fraction}`;
  }

  private getSelectedMethod(method: string | undefined) {
    if (
      method === 'CASH' ||
      method === 'CHEQUE' ||
      method === 'BANK_TRANSFER' ||
      method === 'CARD' ||
      method === 'MIXED'
    ) {
      return method;
    }

    return '';
  }

  private getDateFromParam(value: string | undefined, endOfDay = false) {
    if (!value) {
      return undefined;
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    }

    return date;
  }

  private getMonthRange(value: string | undefined) {
    if (!value || !/^\d{4}-\d{2}$/.test(value)) {
      return undefined;
    }

    const [yearValue, monthValue] = value.split('-');
    const year = Number(yearValue);
    const month = Number(monthValue);

    if (month < 1 || month > 12) {
      return undefined;
    }

    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 1),
    };
  }

  private includesSearch(value: string | null | undefined, query: string) {
    return value?.toLowerCase().includes(query.toLowerCase()) ?? false;
  }

  private formatPaymentReference(payment: { id: string; paymentDate: Date }) {
    const datePart = payment.paymentDate
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', '');
    const idPart = payment.id.slice(-4).toUpperCase();

    return `PAY-${datePart}-${idPart}`;
  }

  reverse(id: string) {
    void id;

    throw new NotImplementedException(
      'Whole payment reversal is not implemented. Use /api/cheques/:id/reverse for cheque reversal.',
    );
  }
}
