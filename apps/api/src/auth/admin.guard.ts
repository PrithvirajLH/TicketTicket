import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthRequest } from './current-user.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;
    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Reports are restricted to administrators');
    }
    return true;
  }
}
