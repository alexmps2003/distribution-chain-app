import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApplicationUser } from './auth.service';
import { AuthGuard } from './auth/auth.guard';

type AuthenticatedRequest = Request & {
  user: ApplicationUser;
};

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return {
      id: request.user.id,
      supabaseUserId: request.user.supabaseUserId,
      email: request.user.email,
      name: request.user.name,
      role: request.user.role,
      isActive: request.user.isActive,
    };
  }
}
