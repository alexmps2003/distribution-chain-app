import { Controller, Get } from '@nestjs/common';
import { OutstandingService } from './outstanding.service';

@Controller('outstanding')
export class OutstandingController {
  constructor(private readonly outstandingService: OutstandingService) {}

  @Get()
  findAll() {
    return this.outstandingService.findAll();
  }
}
