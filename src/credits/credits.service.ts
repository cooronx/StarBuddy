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
    const reservedCredits = await this.getReservedCredits(userId);

    return {
      creditsBalance: user.creditsBalance,
      reservedCredits,
      availableCredits: user.creditsBalance - reservedCredits,
    };
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

  private async getReservedCredits(userId: string) {
    const rows = await this.prisma.$queryRaw<{ reserved_credits: number }[]>`
      select coalesce(sum(st.reward_credits), 0)::int as reserved_credits
      from task_claims tc
      join star_tasks st on st.id = tc.task_id
      join repositories r on r.id = tc.repository_id
      where r.owner_user_id = ${userId}
        and tc.status = 'claimed'
        and tc.expires_at > now()
    `;

    return rows[0]?.reserved_credits ?? 0;
  }
}
