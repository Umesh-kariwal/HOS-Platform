import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(
    tenantId: string,
    branchId: string,
    loggedById: string,
    data: {
      roomId?: string;
      description: string;
      priority: string;
      category: string;
      assignedEmployeeId?: string;
    },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // 1. Verify Room if provided
      if (data.roomId) {
        const room = await tx.room.findFirst({
          where: { id: data.roomId, tenantId, branchId },
        });
        if (!room) {
          throw new NotFoundException(`Room with ID '${data.roomId}' not found in this branch.`);
        }
      }

      // 2. Verify Assigned Employee if provided
      if (data.assignedEmployeeId) {
        const emp = await tx.employee.findFirst({
          where: { id: data.assignedEmployeeId, tenantId },
        });
        if (!emp) {
          throw new NotFoundException(`Assigned Employee with ID '${data.assignedEmployeeId}' not found.`);
        }
      }

      // 3. Create Ticket
      const ticketStatus = data.assignedEmployeeId ? 'in_progress' : 'open';
      const ticket = await tx.maintenanceTicket.create({
        data: {
          tenantId,
          branchId,
          roomId: data.roomId || null,
          description: data.description,
          priority: data.priority,
          category: data.category,
          status: ticketStatus,
          assignedEmployeeId: data.assignedEmployeeId || null,
          loggedById,
        },
        include: {
          room: true,
          assignedEmployee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          loggedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      // 4. Update room physicalStatus to 'maintenance' if priority is critical or status is open/in_progress
      if (data.roomId && (data.priority === 'critical' || ['open', 'in_progress'].includes(ticketStatus))) {
        await tx.room.update({
          where: { id: data.roomId },
          data: { physicalStatus: 'maintenance' },
        });
      }

      return ticket;
    });
  }

  async getTickets(
    tenantId: string,
    branchId: string,
    filters: { status?: string; priority?: string; roomId?: string },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      return tx.maintenanceTicket.findMany({
        where: {
          tenantId,
          branchId,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.priority ? { priority: filters.priority } : {}),
          ...(filters.roomId ? { roomId: filters.roomId } : {}),
        },
        include: {
          room: true,
          assignedEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
          loggedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  }

  async assignTicket(tenantId: string, branchId: string, id: string, assignedEmployeeId: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const ticket = await tx.maintenanceTicket.findFirst({
        where: { id, tenantId, branchId },
      });
      if (!ticket) {
        throw new NotFoundException(`Maintenance ticket with ID '${id}' not found.`);
      }

      if (['completed', 'cancelled'].includes(ticket.status)) {
        throw new BadRequestException(`Cannot assign employee to a ${ticket.status} ticket.`);
      }

      const employee = await tx.employee.findFirst({
        where: { id: assignedEmployeeId, tenantId },
      });
      if (!employee) {
        throw new NotFoundException(`Employee with ID '${assignedEmployeeId}' not found.`);
      }

      return tx.maintenanceTicket.update({
        where: { id },
        data: {
          assignedEmployeeId,
          status: 'in_progress',
        },
        include: {
          room: true,
          assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });
  }

  async completeTicket(tenantId: string, branchId: string, id: string, completionNotes: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const ticket = await tx.maintenanceTicket.findFirst({
        where: { id, tenantId, branchId },
      });
      if (!ticket) {
        throw new NotFoundException(`Maintenance ticket with ID '${id}' not found.`);
      }

      if (['completed', 'cancelled'].includes(ticket.status)) {
        throw new BadRequestException(`Ticket is already ${ticket.status}.`);
      }

      const updatedTicket = await tx.maintenanceTicket.update({
        where: { id },
        data: {
          status: 'completed',
          completionNotes,
          completedAt: new Date(),
        },
        include: { room: true },
      });

      // If linked to a room, check if there are other active/open/in-progress maintenance tickets for this room.
      // If none, restore room status back to 'clean'.
      if (ticket.roomId) {
        const remaining = await tx.maintenanceTicket.count({
          where: {
            roomId: ticket.roomId,
            tenantId,
            branchId,
            status: { in: ['open', 'in_progress'] },
          },
        });

        if (remaining === 0) {
          await tx.room.update({
            where: { id: ticket.roomId },
            data: { physicalStatus: 'clean' },
          });
        }
      }

      return updatedTicket;
    });
  }

  async cancelTicket(tenantId: string, branchId: string, id: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const ticket = await tx.maintenanceTicket.findFirst({
        where: { id, tenantId, branchId },
      });
      if (!ticket) {
        throw new NotFoundException(`Maintenance ticket with ID '${id}' not found.`);
      }

      if (['completed', 'cancelled'].includes(ticket.status)) {
        throw new BadRequestException(`Ticket is already ${ticket.status}.`);
      }

      const updatedTicket = await tx.maintenanceTicket.update({
        where: { id },
        data: {
          status: 'cancelled',
        },
        include: { room: true },
      });

      // If linked to a room, check remaining tickets to restore room status if needed.
      if (ticket.roomId) {
        const remaining = await tx.maintenanceTicket.count({
          where: {
            roomId: ticket.roomId,
            tenantId,
            branchId,
            status: { in: ['open', 'in_progress'] },
          },
        });

        if (remaining === 0) {
          await tx.room.update({
            where: { id: ticket.roomId },
            data: { physicalStatus: 'clean' },
          });
        }
      }

      return updatedTicket;
    });
  }

  async getStaff(tenantId: string, branchId: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      return tx.employee.findMany({
        where: { tenantId, branchId, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
        orderBy: {
          firstName: 'asc',
        },
      });
    });
  }
}
