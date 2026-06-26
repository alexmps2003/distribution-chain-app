import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { customers } from '../db/schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    return this.databaseService.db.select().from(customers);
  }

  async create(dto: CreateCustomerDto) {
    const [customer] = await this.databaseService.db
      .insert(customers)
      .values({
        id: `cust_${crypto.randomUUID()}`,
        code: dto.code,
        name: dto.name,
        contactPerson: dto.contactPerson,
        ownerName: dto.ownerName,
        phone: dto.phone,
        whatsappNumber: dto.whatsappNumber,
        email: dto.email,
        address: dto.address,
        area: dto.area,
        routeName: dto.routeName,
        assignedSalesRep: dto.assignedSalesRep,
        assignedCollector: dto.assignedCollector,
        creditLimit: dto.creditLimit ?? '0',
        openingOutstanding: dto.openingOutstanding ?? '0',
        paymentTermsDays: dto.paymentTermsDays ?? 0,
        isActive: dto.isActive ?? true,
        createdAt: new Date(),
      })
      .returning();

    return customer;
  }

  async findOne(id: string) {
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    return customer ?? null;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const [customer] = await this.databaseService.db
      .update(customers)
      .set(dto)
      .where(eq(customers.id, id))
      .returning();

    return customer ?? null;
  }
}
