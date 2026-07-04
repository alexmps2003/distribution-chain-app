import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService, type ApplicationUser } from './auth.service';
import { AuthGuard } from './auth/auth.guard';

type AuthenticatedRequest = Request & {
  user: ApplicationUser;
};

type LoginBody = {
  email?: string;
  password?: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginBody) {
    return this.authService.signInWithPassword(
      body.email?.trim() ?? '',
      body.password ?? '',
    );
  }

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
