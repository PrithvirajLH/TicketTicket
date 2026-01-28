import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthRequest } from './current-user.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const userId = request.headers['x-user-id'];
    const email = request.headers['x-user-email'];

    if (!userId && !email) {
      throw new UnauthorizedException('Missing user header');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          typeof userId === 'string' ? { id: userId } : undefined,
          typeof email === 'string' ? { email } : undefined,
        ].filter(Boolean) as { id?: string; email?: string }[],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Unknown user');
    }

    const membership = await this.prisma.teamMember.findFirst({
      where: { userId: user.id },
      include: { team: true },
    });

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      teamId: membership?.teamId ?? null,
      teamRole: membership?.role ?? null,
    };

    return true;
  }
}
