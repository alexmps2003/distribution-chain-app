import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { payments } from '../db/schema';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(dto: CreatePaymentDto) {
    const [payment] = await this.databaseService.db
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

    return payment;
  }
}
