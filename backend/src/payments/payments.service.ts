import { Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  create(dto: CreatePaymentDto) {
    return {
      message: 'Payment creation endpoint ready',
      input: dto,
    };
  }
}
