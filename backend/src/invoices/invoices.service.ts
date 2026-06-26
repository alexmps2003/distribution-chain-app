import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { invoices } from '../db/schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    return this.databaseService.db.select().from(invoices);
  }

  async create(dto: CreateInvoiceDto) {
    const [invoice] = await this.databaseService.db
      .insert(invoices)
      .values({
        id: `inv_${crypto.randomUUID()}`,
        invoiceNumber: dto.invoiceNumber,
        amount: dto.amount,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: dto.status ?? 'UNPAID',
        customerId: dto.customerId,
        createdAt: new Date(),
      })
      .returning();

    return invoice;
  }

  async findOne(id: string) {
    const [invoice] = await this.databaseService.db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));

    return invoice ?? null;
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const [invoice] = await this.databaseService.db
      .update(invoices)
      .set({
        ...dto,
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      })
      .where(eq(invoices.id, id))
      .returning();

    return invoice ?? null;
  }

  async remove(id: string) {
    const [invoice] = await this.databaseService.db
      .delete(invoices)
      .where(eq(invoices.id, id))
      .returning();

    return invoice ?? null;
  }
}
