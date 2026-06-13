import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsGateway } from './incidents.gateway';
import * as crypto from 'crypto';

@Injectable()
export class PeripheralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidentsGateway: IncidentsGateway,
  ) {}

  // ==========================================
  // 1. PARKING SLOT MANAGEMENT
  // ==========================================

  async createParkingSlot(tenantId: string, branchId: string, slotIdentifier: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // Check for slot identifier uniqueness in active branch
      const existing = await tx.parkingSlot.findFirst({
        where: {
          tenantId,
          branchId,
          slotIdentifier,
        },
      });

      if (existing) {
        throw new ConflictException(`Parking slot '${slotIdentifier}' already exists in this branch.`);
      }

      return tx.parkingSlot.create({
        data: {
          tenantId,
          branchId,
          slotIdentifier,
          status: 'vacant',
        },
      });
    });
  }

  async getParkingSlots(tenantId: string, branchId: string, status?: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      return tx.parkingSlot.findMany({
        where: {
          tenantId,
          branchId,
          ...(status ? { status } : {}),
        },
        orderBy: {
          slotIdentifier: 'asc',
        },
      });
    });
  }

  // ==========================================
  // 2. VALET TICKET WORKFLOW
  // ==========================================

  async createValetTicket(
    tenantId: string,
    branchId: string,
    data: { bookingId: string; vehicleLicense: string; keyTag: string; parkingSlotId?: string },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // 1. Verify booking exists and guest is currently in-house (checked_in)
      const booking = await tx.booking.findFirst({
        where: {
          id: data.bookingId,
          tenantId,
          branchId,
        },
      });

      if (!booking) {
        throw new NotFoundException(`Active booking with ID '${data.bookingId}' not found.`);
      }
      if (booking.status !== 'checked_in') {
        throw new BadRequestException(`Valet ticket cannot be issued for booking status: ${booking.status}`);
      }

      // 2. Verify parking slot is vacant if assigned
      if (data.parkingSlotId) {
        const slot = await tx.parkingSlot.findFirst({
          where: {
            id: data.parkingSlotId,
            tenantId,
            branchId,
          },
        });
        if (!slot) {
          throw new NotFoundException(`Parking slot with ID '${data.parkingSlotId}' not found.`);
        }
        if (slot.status !== 'vacant') {
          throw new ConflictException(`Parking slot '${slot.slotIdentifier}' is currently ${slot.status}.`);
        }

        // Update slot status to occupied
        await tx.parkingSlot.update({
          where: { id: slot.id },
          data: { status: 'occupied' },
        });
      }

      // 3. Create Valet Ticket
      return tx.valetTicket.create({
        data: {
          tenantId,
          branchId,
          bookingId: data.bookingId,
          vehicleLicense: data.vehicleLicense,
          keyTag: data.keyTag,
          parkingSlotId: data.parkingSlotId || null,
          status: 'parked',
        },
        include: {
          parkingSlot: true,
          booking: {
            include: {
              guest: true,
            },
          },
        },
      });
    });
  }

  async getValetTickets(tenantId: string, branchId: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      return tx.valetTicket.findMany({
        where: {
          tenantId,
          branchId,
          status: { not: 'retrieved' }, // only show active tickets
        },
        include: {
          parkingSlot: true,
          booking: {
            include: {
              guest: true,
              room: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  }

  async requestVehicle(tenantId: string, branchId: string, id: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const ticket = await tx.valetTicket.findFirst({
        where: { id, tenantId, branchId },
      });
      if (!ticket) {
        throw new NotFoundException(`Valet ticket with ID '${id}' not found.`);
      }
      if (ticket.status !== 'parked') {
        throw new BadRequestException(`Cannot request vehicle in state: ${ticket.status}`);
      }

      return tx.valetTicket.update({
        where: { id },
        data: { status: 'requested' },
        include: { parkingSlot: true },
      });
    });
  }

  async retrieveVehicle(tenantId: string, branchId: string, id: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const ticket = await tx.valetTicket.findFirst({
        where: { id, tenantId, branchId },
      });
      if (!ticket) {
        throw new NotFoundException(`Valet ticket with ID '${id}' not found.`);
      }
      if (ticket.status === 'retrieved') {
        throw new BadRequestException(`Vehicle has already been retrieved.`);
      }

      // Update slot back to vacant if one was assigned
      if (ticket.parkingSlotId) {
        await tx.parkingSlot.update({
          where: { id: ticket.parkingSlotId },
          data: { status: 'vacant' },
        });
      }

      return tx.valetTicket.update({
        where: { id },
        data: {
          status: 'retrieved',
          parkingSlotId: null, // clear parking slot assignment
        },
        include: {
          booking: {
            include: {
              guest: true,
            },
          },
        },
      });
    });
  }

  // ==========================================
  // 3. VISITOR RECORD (WITH SHA-256 HASHING)
  // ==========================================

  async createVisitorRecord(
    tenantId: string,
    branchId: string,
    data: { bookingId: string; firstName: string; lastName: string; idNumber: string },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // 1. Verify booking exists
      const booking = await tx.booking.findFirst({
        where: { id: data.bookingId, tenantId, branchId },
      });
      if (!booking) {
        throw new NotFoundException(`Active booking with ID '${data.bookingId}' not found.`);
      }

      // 2. Perform Server-Side SHA-256 Hashing on raw ID number to protect PII
      const idHash = crypto.createHash('sha256').update(data.idNumber).digest('hex');

      // 3. Insert record using the hash (scrubbing raw idNumber immediately)
      return tx.visitorRecord.create({
        data: {
          tenantId,
          bookingId: data.bookingId,
          firstName: data.firstName,
          lastName: data.lastName,
          idHash,
          checkInTime: new Date(),
        },
        include: {
          booking: {
            include: {
              room: true,
            },
          },
        },
      });
    });
  }

  async getVisitorRecords(tenantId: string, branchId: string, activeOnly = false) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      return tx.visitorRecord.findMany({
        where: {
          tenantId,
          booking: {
            branchId,
          },
          ...(activeOnly ? { checkOutTime: null } : {}),
        },
        include: {
          booking: {
            include: {
              room: true,
              guest: true,
            },
          },
        },
        orderBy: {
          checkInTime: 'desc',
        },
      });
    });
  }

  async checkoutVisitor(tenantId: string, branchId: string, id: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const record = await tx.visitorRecord.findFirst({
        where: {
          id,
          tenantId,
          booking: {
            branchId,
          },
        },
      });
      if (!record) {
        throw new NotFoundException(`Visitor record with ID '${id}' not found.`);
      }
      if (record.checkOutTime) {
        throw new BadRequestException('Visitor is already checked out.');
      }

      return tx.visitorRecord.update({
        where: { id },
        data: { checkOutTime: new Date() },
      });
    });
  }

  // ==========================================
  // 4. LOST AND FOUND TRACKING
  // ==========================================

  async reportLostAndFoundItem(
    tenantId: string,
    branchId: string,
    finderEmployeeId: string,
    data: { roomId?: string; description: string; storageBin: string },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // Verify Room exists in same branch if roomId is provided
      if (data.roomId) {
        const room = await tx.room.findFirst({
          where: { id: data.roomId, tenantId, branchId },
        });
        if (!room) {
          throw new NotFoundException(`Room with ID '${data.roomId}' not found in this branch.`);
        }
      }

      return tx.lostAndFoundItem.create({
        data: {
          tenantId,
          branchId,
          roomId: data.roomId || null,
          description: data.description,
          storageBin: data.storageBin,
          finderEmployeeId,
          status: 'reported',
        },
        include: {
          room: true,
          finder: true,
        },
      });
    });
  }

  async getLostAndFoundItems(tenantId: string, branchId: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      return tx.lostAndFoundItem.findMany({
        where: { tenantId, branchId },
        include: {
          room: true,
          finder: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          status: 'desc', // Reported first, then Claimed
        },
      });
    });
  }

  async claimLostAndFoundItem(tenantId: string, branchId: string, id: string, claimantName: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const item = await tx.lostAndFoundItem.findFirst({
        where: { id, tenantId, branchId },
      });
      if (!item) {
        throw new NotFoundException(`Item with ID '${id}' not found.`);
      }
      if (item.status === 'claimed') {
        throw new BadRequestException(`Item has already been claimed.`);
      }

      return tx.lostAndFoundItem.update({
        where: { id },
        data: {
          status: 'claimed',
          claimantName,
          claimedAt: new Date(),
        },
      });
    });
  }

  // ==========================================
  // 5. INCIDENT / PANIC LOGGING
  // ==========================================

  async logIncident(
    tenantId: string,
    branchId: string,
    loggedById: string,
    data: { type: string; details: string; escalationLevel?: number },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      return tx.incidentLog.create({
        data: {
          tenantId,
          branchId,
          type: data.type,
          details: data.details,
          loggedById,
          escalationLevel: data.escalationLevel || 1,
          status: 'active',
        },
        include: {
          loggedBy: true,
        },
      });
    });
  }

  async triggerPanic(tenantId: string, branchId: string, loggedById: string, details: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // 1. Write the panic incident to the database
      const incident = await tx.incidentLog.create({
        data: {
          tenantId,
          branchId,
          type: 'panic',
          details: details || 'EMERGENCY: Panic Button triggered!',
          loggedById,
          escalationLevel: 3, // P1 Panic level
          status: 'active',
        },
        include: {
          loggedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // 2. Broadcast panic alert in real-time via WebSocket
      const alertPayload = {
        id: incident.id,
        branchId: incident.branchId,
        type: 'panic',
        details: incident.details,
        loggedBy: `${incident.loggedBy.firstName} ${incident.loggedBy.lastName}`,
        createdAt: incident.createdAt,
      };

      this.incidentsGateway.broadcastPanic(branchId, alertPayload);

      return incident;
    });
  }

  async getIncidents(tenantId: string, branchId: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      return tx.incidentLog.findMany({
        where: { tenantId, branchId },
        include: {
          loggedBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  }
}
