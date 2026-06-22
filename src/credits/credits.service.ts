import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditsBalance: true },
    });

    return { creditsBalance: user.creditsBalance };
  }

  async getLedger(userId: string) {
    const entries = await this.prisma.creditLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return entries.map((entry) => ({
      id: entry.id,
      amount: entry.amount,
      reason: entry.reason,
      relatedEntityType: entry.relatedEntityType,
      relatedEntityId: entry.relatedEntityId,
      createdAt: entry.createdAt,
    }));
  }
}
