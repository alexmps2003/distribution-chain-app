import { Injectable } from '@nestjs/common';
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
