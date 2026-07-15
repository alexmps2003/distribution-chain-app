import { BadRequestException } from '@nestjs/common';
import { CreatePaymentValidationPipe } from './create-payment-validation.pipe';
import { CreatePaymentDto } from './dto/create-payment.dto';

describe('CreatePaymentValidationPipe', () => {
  const pipe = new CreatePaymentValidationPipe();

  const paymentWithAllocation = (amount: unknown) =>
    ({
      customerId: 'customer-1',
      amount: '10.00',
      methods: [
        {
          method: 'CASH',
          amount: '10.00',
          allocations: [{ invoiceId: 'invoice-1', amount }],
        },
      ],
    }) as CreatePaymentDto;

  it.each(['-1.00', '0', '0.00', '1.001', 'NaN', 'Infinity', 'abc'])(
    'rejects invalid allocation amount %s',
    (amount) => {
      expect(() => pipe.transform(paymentWithAllocation(amount))).toThrow(
        BadRequestException,
      );
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite numeric allocation amount %s',
    (amount) => {
      expect(() => pipe.transform(paymentWithAllocation(amount))).toThrow(
        BadRequestException,
      );
    },
  );

  it.each(['0.01', '1', '1.5', '9999999999.99'])(
    'accepts valid allocation amount %s',
    (amount) => {
      const dto = paymentWithAllocation(amount);

      expect(pipe.transform(dto)).toBe(dto);
    },
  );
});
