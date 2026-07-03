import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { createClient, type User } from '@supabase/supabase-js';
import { DatabaseService } from '../database/database.service';
import { users } from '../db/schema';

export type ApplicationUser = typeof users.$inferSelect;

@Injectable()
export class AuthService {
  readonly supabase: ReturnType<typeof createClient>;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!url || !serviceRoleKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    this.supabase = createClient(url, serviceRoleKey);
  }

  async verifyAccessToken(accessToken: string): Promise<User | null> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(accessToken);

    if (error || !user) {
      return null;
    }

    return user;
  }

  async signInWithPassword(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const applicationUser = await this.getApplicationUser(data.user.id);

    if (!applicationUser) {
      throw new UnauthorizedException('User is not registered or inactive');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: applicationUser.id,
        supabaseUserId: applicationUser.supabaseUserId,
        email: applicationUser.email,
        name: applicationUser.name,
        role: applicationUser.role,
        isActive: applicationUser.isActive,
      },
    };
  }

  async getApplicationUser(
    supabaseUserId: string,
  ): Promise<ApplicationUser | null> {
    const [applicationUser] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.supabaseUserId, supabaseUserId));

    if (!applicationUser || !applicationUser.isActive) {
      return null;
    }

    return applicationUser;
  }
}
