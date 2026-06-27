import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(
    @Query('from') from?: string,
    @Query('method') method?: string,
    @Query('month') month?: string,
    @Query('q') query?: string,
    @Query('search') search?: string,
    @Query('to') to?: string,
  ) {
    return this.paymentsService.findAll({
      from,
      method,
      month,
      query,
      search,
      to,
    });
  }

  @Post()
  create(@Body() body: CreatePaymentDto) {
    return this.paymentsService.create(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id/reverse')
  reverse(@Param('id') id: string) {
    return this.paymentsService.reverse(id);
  }
}
