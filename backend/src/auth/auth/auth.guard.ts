import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, type ApplicationUser } from '../auth.service';

type AuthenticatedRequest = Request & {
  user?: ApplicationUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const accessToken = authorization.slice('Bearer '.length);
    const supabaseUser = await this.authService.verifyAccessToken(accessToken);

    if (!supabaseUser) {
      throw new UnauthorizedException('Invalid access token');
    }

    const applicationUser = await this.authService.getApplicationUser(
      supabaseUser.id,
    );

    if (!applicationUser) {
      throw new UnauthorizedException('User is not registered or inactive');
    }

    request.user = applicationUser;

    return true;
  }
}
