import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { customers } from '../db/schema';

@Injectable()
export class CustomersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    return this.databaseService.db.select().from(customers);
  }

  async findOne(id: string) {
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    return customer ?? null;
  }
}