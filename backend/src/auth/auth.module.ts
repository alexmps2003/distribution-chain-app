import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../database/database.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [AuthService, AuthGuard, RolesGuard],
  exports: [AuthService, AuthGuard, RolesGuard],
  controllers: [AuthController],
})
export class AuthModule {}
