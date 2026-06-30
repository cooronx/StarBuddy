import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly maintenance: MaintenanceService,
  ) {}

  @Get('system')
  getSystemStatus() {
    return this.admin.getSystemStatus();
  }

  @Get('reports')
  listReports() {
    return this.admin.listReports();
  }

  @Post('repositories/:id/archive')
  archiveRepository(@Param('id') id: string) {
    return this.admin.archiveRepository(id);
  }

  @Post('repositories/:id/reject')
  rejectRepository(@Param('id') id: string) {
    return this.admin.rejectRepository(id);
  }

  @Post('repositories/:id/restore')
  restoreRepository(@Param('id') id: string) {
    return this.admin.restoreRepository(id);
  }

  @Post('users/:id/suspend')
  suspendUser(@Param('id') id: string) {
    return this.admin.suspendUser(id);
  }

  @Post('users/:id/unsuspend')
  unsuspendUser(@Param('id') id: string) {
    return this.admin.unsuspendUser(id);
  }

  @Post('cleanup')
  cleanup() {
    return this.maintenance.cleanupExpiredData();
  }
}
