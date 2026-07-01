import { SetMetadata } from '@nestjs/common';
import { type ApplicationUser } from './auth.service';

export const ROLES_KEY = 'roles';

export type Role = ApplicationUser['role'];

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
