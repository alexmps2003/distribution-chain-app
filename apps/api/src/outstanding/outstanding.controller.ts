import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OutstandingService } from './outstanding.service';

@Controller('outstanding')
@UseGuards(AuthGuard, RolesGuard)
export class OutstandingController {
  constructor(private readonly outstandingService: OutstandingService) {}

  @Get('export')
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="outstanding-invoices.csv"',
  )
  exportCsv(@Query('customerId') customerId?: string) {
    return this.outstandingService.exportCsv(customerId);
  }

  @Get()
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
  findAll(@Query('customerId') customerId?: string) {
    return this.outstandingService.findAll(customerId);
  }
}
