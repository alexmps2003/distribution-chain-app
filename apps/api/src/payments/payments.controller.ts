import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(AuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
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
  @Roles('ADMIN', 'COLLECTOR')
  create(@Body() body: CreatePaymentDto) {
    return this.paymentsService.create(body);
  }

  @Get(':id')
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id/reverse')
  @Roles('ADMIN')
  reverse(@Param('id') id: string) {
    return this.paymentsService.reverse(id);
  }
}
