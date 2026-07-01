import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(AuthGuard, RolesGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Roles('ADMIN', 'SALES_REP', 'COLLECTOR')
  search(@Query('q') query?: string) {
    return this.searchService.search(query ?? '');
  }
}
