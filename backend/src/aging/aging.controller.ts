import { Controller, Get } from '@nestjs/common';
import { AgingService } from './aging.service';

@Controller('aging')
export class AgingController {
  constructor(private readonly agingService: AgingService) {}

  @Get()
  findAll() {
    return this.agingService.findAll();
  }
}
