import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(page = 1, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const p = Math.max(page, 1);
    const skip = (p - 1) * take;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: { select: { creditCards: true } },
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        cardCount: u._count.creditCards,
      })),
      total,
      page: p,
      limit: take,
      pages: Math.ceil(total / take) || 1,
    };
  }

  async updateUser(actorId: string, userId: string, dto: AdminUpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (dto.role === undefined && dto.isActive === undefined) {
      throw new BadRequestException('Provide isActive and/or role');
    }

    if (userId === actorId) {
      if (dto.isActive === false) {
        throw new BadRequestException('You cannot disable your own account');
      }
      if (dto.role && dto.role !== target.role) {
        throw new BadRequestException('You cannot change your own role here');
      }
    }

    if (dto.isActive === false) {
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }
}
