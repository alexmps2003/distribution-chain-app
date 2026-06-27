import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  async findAll() {
    return this.collectionsService.findAll();
  }

  @Post()
  async create(@Body() body: CreateCollectionDto) {
    return this.collectionsService.create(body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.collectionsService.findOne(id);
  }
}
