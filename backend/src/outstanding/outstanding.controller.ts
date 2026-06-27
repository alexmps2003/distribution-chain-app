import { Controller, Get, Query } from '@nestjs/common';
import { OutstandingService } from './outstanding.service';

@Controller('outstanding')
export class OutstandingController {
  constructor(private readonly outstandingService: OutstandingService) {}

  @Get()
  findAll(@Query('customerId') customerId?: string) {
    return this.outstandingService.findAll(customerId);
  }
}
