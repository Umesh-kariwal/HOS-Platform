import { Controller, Get, Post, Delete, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RevenueService } from './revenue.service';

@Controller('revenue')
@UseGuards(AuthGuard('jwt'))
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Post('rules')
  async createRule(
    @Request() req: any,
    @Body() body: {
      roomTypeId: string;
      ruleType: string;
      triggerValue: number;
      adjustmentPercent: number;
    },
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    return this.revenueService.createRule(tenantId, branchId, body);
  }

  @Get('rules')
  async getRules(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    return this.revenueService.getRules(tenantId, branchId);
  }

  @Delete('rules/:id')
  async deleteRule(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    return this.revenueService.deleteRule(tenantId, branchId, id);
  }

  @Get('calculate-rate')
  async calculateRate(
    @Request() req: any,
    @Query('roomTypeId') roomTypeId: string,
    @Query('date') date: string,
    @Query('leadTimeDays') leadTimeDays: string,
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    const rate = await this.revenueService.calculateDynamicRate(
      tenantId,
      branchId,
      roomTypeId,
      date,
      parseInt(leadTimeDays, 10) || 0,
    );
    return { rate };
  }
}
