import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReverseChequeDto } from './dto/reverse-cheque.dto';
import { ChequesService } from './cheques.service';

@Controller('cheques')
@UseGuards(AuthGuard, RolesGuard)
export class ChequesController {
  constructor(private readonly chequesService: ChequesService) {}

  @Get()
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
  findAll(
    @Query('q') query?: string,
    @Query('bank') bank?: string,
    @Query('status') status?: string,
  ) {
    return this.chequesService.findAll({ bank, query, status });
  }

  @Get(':id')
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
  findOne(@Param('id') id: string) {
    return this.chequesService.findOne(id);
  }

  @Patch(':id/reverse')
  @Roles('ADMIN')
  reverse(@Param('id') id: string, @Body() dto: ReverseChequeDto) {
    return this.chequesService.reverse(id, dto);
  }

  @Patch(':id/undo-reversal')
  @Roles('ADMIN')
  undoReversal(@Param('id') id: string) {
    return this.chequesService.undoReversal(id);
  }
}
