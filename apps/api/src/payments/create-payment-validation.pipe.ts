import { BadRequestException, PipeTransform } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { parsePositiveMoneyToCents } from './payment-amount';

export class CreatePaymentValidationPipe implements PipeTransform {
  transform(value: CreatePaymentDto) {
    if (!value || !Array.isArray(value.methods)) {
      return value;
    }

    for (const method of value.methods) {
      if (method.allocations === undefined) {
        continue;
      }

      if (!Array.isArray(method.allocations)) {
        throw this.invalidAllocationAmount();
      }

      for (const allocation of method.allocations) {
        if (
          !allocation ||
          parsePositiveMoneyToCents(allocation.amount) === null
        ) {
          throw this.invalidAllocationAmount();
        }
      }
    }

    return value;
  }

  private invalidAllocationAmount() {
    return new BadRequestException(
      'Allocation amount must be greater than 0 with at most 2 decimal places',
    );
  }
}
