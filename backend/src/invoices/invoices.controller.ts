import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async findAll() {
    return this.invoicesService.findAll();
  }

  @Post()
  async create(@Body() body: CreateInvoiceDto) {
    return this.invoicesService.create(body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateInvoiceDto) {
    return this.invoicesService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
