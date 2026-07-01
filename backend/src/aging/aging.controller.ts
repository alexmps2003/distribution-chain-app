import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AgingService } from './aging.service';

@Controller('aging')
@UseGuards(AuthGuard, RolesGuard)
export class AgingController {
  constructor(private readonly agingService: AgingService) {}

  @Get()
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
  findAll() {
    return this.agingService.findAll();
  }
}
