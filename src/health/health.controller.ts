import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`select 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
        time: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      database: 'ok',
      environment: process.env.NODE_ENV ?? 'development',
      version: process.env.npm_package_version ?? '0.1.0',
      time: new Date().toISOString(),
    };
  }
}
