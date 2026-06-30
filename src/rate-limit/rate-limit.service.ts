import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface RateLimitOptions {
  eventType: string;
  maxEvents: number;
  windowMs: number;
  userId?: string;
  ipAddress?: string;
}

@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async consume(options: RateLimitOptions) {
    const since = new Date(Date.now() - options.windowMs);

    await this.prisma.$transaction(async (tx) => {
      const count = await tx.rateLimitEvent.count({
        where: {
          eventType: options.eventType,
          createdAt: { gte: since },
          ...(options.userId ? { userId: options.userId } : {}),
          ...(options.ipAddress ? { ipAddress: options.ipAddress } : {}),
        },
      });

      if (count >= options.maxEvents) {
        throw new HttpException(
          'Too many requests. Try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await tx.rateLimitEvent.create({
        data: {
          eventType: options.eventType,
          userId: options.userId,
          ipAddress: options.ipAddress,
        },
      });
    });
  }
}
