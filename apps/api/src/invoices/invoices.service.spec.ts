import { BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { invoices, paymentAllocations } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsTemplateService } from '../notifications/sms-template.service';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

describe('InvoicesService update security invariants', () => {
  it('updates an unpaid invoice in one transaction with an explicit field allowlist', async () => {
    const harness = createUpdateHarness(false);
    const service = createService(harness.db);
    const dto = {
      invoiceNumber: 'INV-UPDATED',
      amount: '125.00',
      dueDate: '2026-02-15',
      customerId: 'customer-2',
      createdAt: new Date('2000-01-01'),
    } as UpdateInvoiceDto & { createdAt: Date };

    await expect(service.update('invoice-1', dto)).resolves.toMatchObject({
      invoiceNumber: 'INV-UPDATED',
      amount: '125.00',
      customerId: 'customer-2',
    });

    expect(harness.transaction).toHaveBeenCalledTimes(1);
    expect(harness.updateValues).toEqual({
      invoiceNumber: 'INV-UPDATED',
      amount: '125.00',
      dueDate: new Date('2026-02-15'),
      customerId: 'customer-2',
    });
    expect(harness.updateValues).not.toHaveProperty('createdAt');
  });

  it.each([
    { amount: '10.00' },
    { customerId: 'customer-2' },
    { invoiceNumber: 'INV-CHANGED' },
    { invoiceDate: '2026-02-01' },
    { dueDate: '2026-02-15' },
    { status: 'CANCELLED' as const },
  ])('rejects allocated invoice changes: %o', async (dto) => {
    const harness = createUpdateHarness(true);
    const service = createService(harness.db);

    await expect(
      service.update('invoice-1', dto as UpdateInvoiceDto),
    ).rejects.toThrow(BadRequestException);
    expect(harness.transaction).toHaveBeenCalledTimes(1);
    expect(harness.update).not.toHaveBeenCalled();
  });
});

function createService(db: object) {
  return new InvoicesService(
    { db } as unknown as DatabaseService,
    { sendSms: jest.fn() } as unknown as NotificationsService,
    {} as SmsTemplateService,
  );
}

function createUpdateHarness(hasAllocation: boolean) {
  const existingInvoice: typeof invoices.$inferSelect = {
    id: 'invoice-1',
    invoiceNumber: 'INV-1',
    amount: '100.00',
    invoiceDate: new Date('2026-01-01'),
    dueDate: null,
    status: 'UNPAID',
    customerId: 'customer-1',
    createdAt: new Date('2026-01-01'),
  };
  let updateValues: Record<string, unknown> = {};
  const update = jest.fn(() => ({
    set: (values: Record<string, unknown>) => {
      updateValues = values;

      return {
        where: () => ({
          returning: () => Promise.resolve([{ ...existingInvoice, ...values }]),
        }),
      };
    },
  }));
  const transaction = jest.fn(
    async (callback: (tx: object) => Promise<unknown>) => {
      const tx = {
        select: () => ({
          from: (table: object) => ({
            where: () => {
              if (table === invoices) {
                return { for: () => Promise.resolve([existingInvoice]) };
              }

              if (table === paymentAllocations) {
                return {
                  limit: () =>
                    Promise.resolve(
                      hasAllocation ? [{ id: 'allocation-1' }] : [],
                    ),
                };
              }

              return { limit: () => Promise.resolve([]) };
            },
          }),
        }),
        update,
      };

      return callback(tx);
    },
  );

  return {
    db: { transaction },
    transaction,
    update,
    get updateValues() {
      return updateValues;
    },
  };
}
