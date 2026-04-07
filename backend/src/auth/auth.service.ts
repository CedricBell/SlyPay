import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashRefresh(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  private newRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  async register(email: string, password: string) {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const user = await this.users.create(email, password);
    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account disabled');
    }
    const ok = await this.users.validatePassword(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string) {
    const hash = this.hashRefresh(refreshToken);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });
    if (!row || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.delete({ where: { id: row.id } });
    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(refreshToken: string) {
    const hash = this.hashRefresh(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash: hash } });
    return { ok: true };
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: UserRole = UserRole.USER,
  ) {
    const accessTtl = this.config.get<string>('JWT_ACCESS_EXPIRES', '15m');
    const refreshDays = Number(
      this.config.get<string>('JWT_REFRESH_DAYS', '14'),
    );

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl as `${number}m` | `${number}d`,
      },
    );

    const rawRefresh = this.newRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshDays);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashRefresh(rawRefresh),
        userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn: accessTwtSeconds(accessTtl),
      tokenType: 'Bearer' as const,
    };
  }
}

function accessTwtSeconds(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m) return 900;
  const n = Number(m[1]);
  const u = m[2];
  const mult =
    u === 's' ? 1 : u === 'm' ? 60 : u === 'h' ? 3600 : u === 'd' ? 86400 : 60;
  return n * mult;
}
