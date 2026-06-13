import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
@UseGuards(AuthGuard('jwt'))
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  async getTickets(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('roomId') roomId?: string,
  ) {
    const { tenantId, branchId } = req.user;
    return this.maintenanceService.getTickets(tenantId, branchId, { status, priority, roomId });
  }

  @Get('staff')
  async getStaff(@Request() req: any) {
    const { tenantId, branchId } = req.user;
    return this.maintenanceService.getStaff(tenantId, branchId);
  }

  @Post()
  async createTicket(
    @Request() req: any,
    @Body()
    body: {
      roomId?: string;
      description: string;
      priority: string;
      category: string;
      assignedEmployeeId?: string;
    },
  ) {
    if (!body.description || !body.priority || !body.category) {
      throw new BadRequestException('description, priority, and category are required.');
    }
    const { tenantId, branchId, employeeId } = req.user;
    return this.maintenanceService.createTicket(tenantId, branchId, employeeId, body);
  }

  @Patch(':id/assign')
  async assignTicket(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { assignedEmployeeId: string },
  ) {
    if (!body.assignedEmployeeId) {
      throw new BadRequestException('assignedEmployeeId is required.');
    }
    const { tenantId, branchId } = req.user;
    return this.maintenanceService.assignTicket(tenantId, branchId, id, body.assignedEmployeeId);
  }

  @Patch(':id/complete')
  async completeTicket(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { completionNotes: string },
  ) {
    if (!body.completionNotes) {
      throw new BadRequestException('completionNotes is required.');
    }
    const { tenantId, branchId } = req.user;
    return this.maintenanceService.completeTicket(tenantId, branchId, id, body.completionNotes);
  }

  @Patch(':id/cancel')
  async cancelTicket(@Request() req: any, @Param('id') id: string) {
    const { tenantId, branchId } = req.user;
    return this.maintenanceService.cancelTicket(tenantId, branchId, id);
  }
}
