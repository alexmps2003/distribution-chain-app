import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { collections } from '../db/schema';
import { CreateCollectionDto } from './dto/create-collection.dto';

@Injectable()
export class CollectionsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    return this.databaseService.db.select().from(collections);
  }

  async create(dto: CreateCollectionDto) {
    const [collection] = await this.databaseService.db
      .insert(collections)
      .values({
        id: crypto.randomUUID(),
        collectorId: dto.collectorId,
        customerId: dto.customerId,
        collectionDate: new Date(dto.collectionDate),
        status: dto.status,
        createdAt: new Date(),
      })
      .returning();

    return collection;
  }

  async findOne(id: string) {
    const [collection] = await this.databaseService.db
      .select()
      .from(collections)
      .where(eq(collections.id, id));

    return collection ?? null;
  }
}
