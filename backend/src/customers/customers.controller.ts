import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
@UseGuards(AuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
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
  @Roles('ADMIN', 'SALES_REP')
  async create(@Body() body: CreateCustomerDto) {
    return this.customersService.create(body);
  }

  @Get(':id')
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
  async findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customersService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
