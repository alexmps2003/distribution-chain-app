import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { StatementsService } from './statements.service';

@Controller('customers')
@UseGuards(AuthGuard, RolesGuard)
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Get(':id/statement')
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
  findCustomerStatement(@Param('id') id: string) {
    return this.statementsService.findCustomerStatement(id);
  }
}
