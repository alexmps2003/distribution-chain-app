import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async findAll() {
    return this.customersService.findAll();
  }

  @Post()
  async create(@Body() body: CreateCustomerDto) {
    return this.customersService.create(body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }
}
