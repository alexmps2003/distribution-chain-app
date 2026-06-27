import { Controller, Get, Header, Query } from '@nestjs/common';
import { OutstandingService } from './outstanding.service';

@Controller('outstanding')
export class OutstandingController {
  constructor(private readonly outstandingService: OutstandingService) {}

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="outstanding-invoices.csv"',
  )
  exportCsv() {
    return this.outstandingService.exportCsv();
  }

  @Get()
  findAll(@Query('customerId') customerId?: string) {
    return this.outstandingService.findAll(customerId);
  }
}
