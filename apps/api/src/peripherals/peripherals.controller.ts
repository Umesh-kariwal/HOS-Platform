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
import { PeripheralsService } from './peripherals.service';

@Controller('peripherals')
@UseGuards(AuthGuard('jwt'))
export class PeripheralsController {
  constructor(private readonly peripheralsService: PeripheralsService) {}

  // ==========================================
  // 1. PARKING SLOT ENDPOINTS
  // ==========================================

  @Get('parking')
  async getParkingSlots(@Request() req: any, @Query('status') status?: string) {
    const { tenantId, branchId } = req.user;
    return this.peripheralsService.getParkingSlots(tenantId, branchId, status);
  }

  @Post('parking')
  async createParkingSlot(@Request() req: any, @Body() body: { slotIdentifier: string }) {
    if (!body.slotIdentifier) {
      throw new BadRequestException('slotIdentifier is required.');
    }
    const { tenantId, branchId } = req.user;
    return this.peripheralsService.createParkingSlot(tenantId, branchId, body.slotIdentifier);
  }

  // ==========================================
  // 2. VALET TICKET ENDPOINTS
  // ==========================================

  @Get('valet')
  async getValetTickets(@Request() req: any) {
    const { tenantId, branchId } = req.user;
    return this.peripheralsService.getValetTickets(tenantId, branchId);
  }

  @Post('valet')
  async createValetTicket(
    @Request() req: any,
    @Body()
    body: {
      bookingId: string;
      vehicleLicense: string;
      keyTag: string;
      parkingSlotId?: string;
    },
  ) {
    if (!body.bookingId || !body.vehicleLicense || !body.keyTag) {
      throw new BadRequestException('bookingId, vehicleLicense, and keyTag are required.');
    }
    const { tenantId, branchId } = req.user;
    return this.peripheralsService.createValetTicket(tenantId, branchId, body);
  }

  @Patch('valet/:id/request')
  async requestVehicle(@Request() req: any, @Param('id') id: string) {
    const { tenantId, branchId } = req.user;
    return this.peripheralsService.requestVehicle(tenantId, branchId, id);
  }

  @Patch('valet/:id/retrieve')
  async retrieveVehicle(@Request() req: any, @Param('id') id: string) {
    const { tenantId, branchId } = req.user;
    return this.peripheralsService.retrieveVehicle(tenantId, branchId, id);
  }

  // ==========================================
  // 3. VISITOR RECORD ENDPOINTS
  // ==========================================

  @Get('visitors')
  async getVisitorRecords(@Request() req: any, @Query('activeOnly') activeOnly?: string) {
    const { tenantId, branchId } = req.user;
    const activeVal = activeOnly === 'true';
    return this.peripheralsService.getVisitorRecords(tenantId, branchId, activeVal);
  }

  @Post('visitors')
  async createVisitorRecord(
    @Request() req: any,
    @Body()
    body: {
      bookingId: string;
      firstName: string;
      lastName: string;
      idNumber: string;
    },
  ) {
    if (!body.bookingId || !body.firstName || !body.lastName || !body.idNumber) {
      throw new BadRequestException('bookingId, firstName, lastName, and idNumber are required.');
    }
    const { tenantId, branchId } = req.user;
    return this.peripheralsService.createVisitorRecord(tenantId, branchId, body);
  }

  @Patch('visitors/:id/checkout')
  async checkoutVisitor(@Request() req: any, @Param('id') id: string) {
    const { tenantId, branchId } = req.user;
    return this.peripheralsService.checkoutVisitor(tenantId, branchId, id);
  }

  // ==========================================
  // 4. LOST AND FOUND ENDPOINTS
  // ==========================================

  @Get('lost-found')
  async getLostAndFoundItems(@Request() req: any) {
    const { tenantId, branchId } = req.user;
    return this.peripheralsService.getLostAndFoundItems(tenantId, branchId);
  }

  @Post('lost-found')
  async reportLostAndFoundItem(
    @Request() req: any,
    @Body() body: { roomId?: string; description: string; storageBin: string },
  ) {
    if (!body.description || !body.storageBin) {
      throw new BadRequestException('description and storageBin are required.');
    }
    const { tenantId, branchId, employeeId } = req.user;
    return this.peripheralsService.reportLostAndFoundItem(tenantId, branchId, employeeId, body);
  }

  @Patch('lost-found/:id/claim')
  async claimLostAndFoundItem(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { claimantName: string },
  ) {
    if (!body.claimantName) {
      throw new BadRequestException('claimantName is required.');
    }
    const { tenantId, branchId } = req.user;
    return this.peripheralsService.claimLostAndFoundItem(tenantId, branchId, id, body.claimantName);
  }

  // ==========================================
  // 5. INCIDENT / PANIC ENDPOINTS
  // ==========================================

  @Get('incidents')
  async getIncidents(@Request() req: any) {
    const { tenantId, branchId } = req.user;
    return this.peripheralsService.getIncidents(tenantId, branchId);
  }

  @Post('incidents')
  async logIncident(
    @Request() req: any,
    @Body() body: { type: string; details: string; escalationLevel?: number },
  ) {
    if (!body.type || !body.details) {
      throw new BadRequestException('type and details are required.');
    }
    const { tenantId, branchId, employeeId } = req.user;
    return this.peripheralsService.logIncident(tenantId, branchId, employeeId, body);
  }

  @Post('incidents/panic')
  async triggerPanic(@Request() req: any, @Body() body: { details?: string }) {
    const { tenantId, branchId, employeeId } = req.user;
    return this.peripheralsService.triggerPanic(tenantId, branchId, employeeId, body.details || '');
  }
}
