import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DispatchService } from './dispatch.service';

@Controller('dispatch')
@UseGuards(AuthGuard('jwt'))
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post()
  async create(
    @Request() req: any,
    @Body() body: {
      bookingId: string;
      requestType: string;
      details?: string;
      assignedEmployeeId?: string;
    },
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    return this.dispatchService.create(tenantId, branchId, body);
  }

  @Get()
  async findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('requestType') requestType?: string,
    @Query('assignedEmployeeId') assignedEmployeeId?: string,
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    return this.dispatchService.findAll(tenantId, branchId, { status, requestType, assignedEmployeeId });
  }

  @Patch(':id/assign')
  async assign(
    @Request() req: any,
    @Param('id') id: string,
    @Body('assignedEmployeeId') assignedEmployeeId: string,
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    return this.dispatchService.assign(tenantId, branchId, id, assignedEmployeeId);
  }

  @Patch(':id/complete')
  async complete(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    return this.dispatchService.complete(tenantId, branchId, id);
  }

  @Patch(':id/cancel')
  async cancel(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    return this.dispatchService.cancel(tenantId, branchId, id);
  }
}
