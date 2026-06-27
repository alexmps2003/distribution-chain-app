import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ReverseChequeDto } from './dto/reverse-cheque.dto';
import { ChequesService } from './cheques.service';

@Controller('cheques')
export class ChequesController {
  constructor(private readonly chequesService: ChequesService) {}

  @Get()
  findAll(
    @Query('q') query?: string,
    @Query('bank') bank?: string,
    @Query('status') status?: string,
  ) {
    return this.chequesService.findAll({ bank, query, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chequesService.findOne(id);
  }

  @Patch(':id/reverse')
  reverse(@Param('id') id: string, @Body() dto: ReverseChequeDto) {
    return this.chequesService.reverse(id, dto);
  }

  @Patch(':id/undo-reversal')
  undoReversal(@Param('id') id: string) {
    return this.chequesService.undoReversal(id);
  }
}
