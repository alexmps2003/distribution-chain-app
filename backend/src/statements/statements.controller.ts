import { Controller, Get, Param } from '@nestjs/common';
import { StatementsService } from './statements.service';

@Controller('customers')
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Get(':id/statement')
  findCustomerStatement(@Param('id') id: string) {
    return this.statementsService.findCustomerStatement(id);
  }
}
