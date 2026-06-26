import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { customers } from '../db/schema';

@Injectable()
export class CustomersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    return this.databaseService.db.select().from(customers);
  }
}