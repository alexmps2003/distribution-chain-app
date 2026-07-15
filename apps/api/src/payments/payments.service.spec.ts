import { BadRequestException } from '@nestjs/common';
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
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

type InvoiceRow = typeof invoices.$inferSelect;
type AllocationRow = typeof paymentAllocations.$inferSelect;
type PartRow = typeof paymentParts.$inferSelect;

describe('PaymentsService security invariants', () => {
  const createDto = (
    amount: string,
    invoiceId = 'invoice-1',
  ): CreatePaymentDto => ({
    customerId: 'customer-1',
    amount,
    methods: [
      {
        method: 'CASH',
        amount,
        allocations: [{ invoiceId, amount }],
      },
    ],
  });

  it.each(['-1.00', '0', '0.00', '1.001', 'NaN', 'Infinity'])(
    'rejects invalid allocation amount %s again at the service boundary',
    async (amount) => {
      const transaction = jest.fn();
      const service = createService({ transaction });
      const dto = createDto('10.00');
      dto.methods[0].allocations![0].amount = amount;

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it('locks invoice ids in deterministic order', async () => {
    const service = createService({ transaction: jest.fn() });
    const lockOrder: string[] = [];
    const invoiceRows = new Map([
      ['invoice-a', invoiceRow('invoice-a')],
      ['invoice-b', invoiceRow('invoice-b')],
    ]);
    const serviceInternals = service as unknown as {
      lockInvoiceForUpdate: (
        tx: unknown,
        invoiceId: string,
      ) => Promise<InvoiceRow | undefined>;
      lockInvoicesForPayment: (
        tx: unknown,
        invoiceIds: string[],
        customerId: string,
      ) => Promise<Map<string, InvoiceRow>>;
    };

    jest
      .spyOn(serviceInternals, 'lockInvoiceForUpdate')
      .mockImplementation((_tx, invoiceId) => {
        lockOrder.push(invoiceId);
        return Promise.resolve(invoiceRows.get(invoiceId));
      });

    await serviceInternals.lockInvoicesForPayment(
      {},
      ['invoice-b', 'invoice-a', 'invoice-b'],
      'customer-1',
    );

    expect(lockOrder).toEqual(['invoice-a', 'invoice-b']);
  });

  it('prevents two simultaneous payments from over-allocating one invoice', async () => {
    const harness = createConcurrentPaymentHarness();
    const service = createService(harness.db);

    const results = await Promise.allSettled([
      service.create(createDto('60.00')),
      service.create(createDto('60.00')),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(harness.allocations).toHaveLength(1);
    expect(harness.allocations[0].amount).toBe('60.00');
  });
});

function createService(db: object) {
  return new PaymentsService(
    { db } as unknown as DatabaseService,
    { sendSms: jest.fn() } as unknown as NotificationsService,
    {
      paymentReceived: jest.fn().mockReturnValue('message'),
    } as unknown as SmsTemplateService,
  );
}

function invoiceRow(id: string): InvoiceRow {
  return {
    id,
    invoiceNumber: id,
    amount: '100.00',
    invoiceDate: new Date('2026-01-01'),
    dueDate: null,
    status: 'UNPAID',
    customerId: 'customer-1',
    createdAt: new Date('2026-01-01'),
  };
}

function createConcurrentPaymentHarness() {
  const invoice = invoiceRow('invoice-1');
  const allocations: AllocationRow[] = [];
  const parts: PartRow[] = [];
  let lockHeld = false;
  const lockWaiters: (() => void)[] = [];

  const releaseLock = () => {
    const next = lockWaiters.shift();

    if (next) {
      next();
    } else {
      lockHeld = false;
    }
  };

  const acquireLock = async () => {
    if (lockHeld) {
      await new Promise<void>((resolve) => lockWaiters.push(resolve));
    } else {
      lockHeld = true;
    }

    return releaseLock;
  };

  const db = {
    transaction: async (callback: (tx: object) => Promise<unknown>) => {
      const stagedAllocations: AllocationRow[] = [];
      const stagedParts: PartRow[] = [];
      const releases: (() => void)[] = [];

      const tx = {
        select: () => ({
          from: (table: object) => ({
            where: () => {
              if (table === invoices) {
                return {
                  for: async () => {
                    releases.push(await acquireLock());
                    return [invoice];
                  },
                };
              }

              if (table === paymentAllocations) {
                return Promise.resolve([...allocations, ...stagedAllocations]);
              }

              if (table === paymentParts) {
                return Promise.resolve([...parts, ...stagedParts]);
              }

              return Promise.resolve([]);
            },
          }),
        }),
        insert: (table: object) => ({
          values: (values: Record<string, unknown>) => ({
            returning: () => {
              if (table === payments) {
                return Promise.resolve([
                  {
                    ...values,
                    status: 'ACTIVE',
                    reversedAt: null,
                    reversalReason: null,
                  },
                ]);
              }

              if (table === paymentParts) {
                const part = {
                  ...values,
                  status: 'ACTIVE',
                  reversedAt: null,
                  reversalReason: null,
                  createdAt: new Date(),
                } as PartRow;
                stagedParts.push(part);
                return Promise.resolve([part]);
              }

              if (table === paymentAllocations) {
                const allocation = values as AllocationRow;
                stagedAllocations.push(allocation);
                return Promise.resolve([allocation]);
              }

              return Promise.resolve([]);
            },
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
      };

      try {
        const result = await callback(tx);
        allocations.push(...stagedAllocations);
        parts.push(...stagedParts);
        return result;
      } finally {
        releases.reverse().forEach((release) => release());
      }
    },
    select: () => ({
      from: (table: object) => ({
        where: () =>
          Promise.resolve(
            table === customers
              ? [
                  {
                    id: 'customer-1',
                    name: 'Customer',
                    phone: null,
                  },
                ]
              : [],
          ),
      }),
    }),
  };

  return { allocations, db };
}
