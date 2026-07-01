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
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@UseGuards(AuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
  async findAll(@Query('customerId') customerId?: string) {
    return this.invoicesService.findAll(customerId);
  }

  @Post()
  @Roles('ADMIN', 'SALES_REP')
  async create(@Body() body: CreateInvoiceDto) {
    return this.invoicesService.create(body);
  }

  @Get(':id')
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SALES_REP')
  async update(@Param('id') id: string, @Body() body: UpdateInvoiceDto) {
    return this.invoicesService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
