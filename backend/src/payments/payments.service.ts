import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { paymentParts, payments } from '../db/schema';
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

    const parts: (typeof paymentParts.$inferSelect)[] = [];

    for (const method of dto.methods) {
      const [part] = await this.databaseService.db
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
    }

    return {
      payment,
      parts,
    };
  }
}
