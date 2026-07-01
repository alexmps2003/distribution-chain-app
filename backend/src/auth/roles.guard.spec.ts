import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { type ApplicationUser } from './auth.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class OpenController {
  open(this: void) {
    return true;
  }
}

class AdminController {
  @Roles('ADMIN')
  admin(this: void) {
    return true;
  }
}

@Roles('COLLECTOR')
class CollectorController {
  collect(this: void) {
    return true;
  }
}

type ControllerClass = new () => unknown;
type Handler = (this: void) => unknown;

function createApplicationUser(role: ApplicationUser['role']): ApplicationUser {
  return {
    id: 'user_1',
    supabaseUserId: 'supabase_1',
    email: 'user@example.com',
    name: 'Test User',
    role,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function createContext(
  controllerClass: ControllerClass,
  handler: Handler,
  user?: ApplicationUser,
): ExecutionContext {
  return {
    getClass: () => controllerClass,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('allows requests when no roles are required', () => {
    const context = createContext(
      OpenController,
      OpenController.prototype.open,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws unauthorized when roles are required and user is missing', () => {
    const context = createContext(
      AdminController,
      AdminController.prototype.admin,
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws forbidden when user role is not allowed', () => {
    const context = createContext(
      AdminController,
      AdminController.prototype.admin,
      createApplicationUser('SALES_REP'),
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows requests when user role is allowed', () => {
    const context = createContext(
      AdminController,
      AdminController.prototype.admin,
      createApplicationUser('ADMIN'),
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('reads roles from class metadata', () => {
    const context = createContext(
      CollectorController,
      CollectorController.prototype.collect,
      createApplicationUser('COLLECTOR'),
    );

    expect(guard.canActivate(context)).toBe(true);
  });
});
