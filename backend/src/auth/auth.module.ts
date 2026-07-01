import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../database/database.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [AuthService, RolesGuard],
  exports: [AuthService, RolesGuard],
  controllers: [AuthController],
})
export class AuthModule {}
