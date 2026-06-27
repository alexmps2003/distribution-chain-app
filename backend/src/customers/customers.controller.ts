import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async findAll(
    @Query('area') area?: string,
    @Query('outstandingOnly') outstandingOnly?: string,
    @Query('q') query?: string,
    @Query('route') route?: string,
    @Query('routeName') routeName?: string,
    @Query('search') search?: string,
  ) {
    return this.customersService.findAll({
      area,
      outstandingOnly,
      query,
      route,
      routeName,
      search,
    });
  }

  @Post()
  async create(@Body() body: CreateCustomerDto) {
    return this.customersService.create(body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customersService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
