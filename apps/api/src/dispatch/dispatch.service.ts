import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DispatchGateway } from './dispatch.gateway';

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: DispatchGateway,
  ) {}

  async create(
    tenantId: string,
    branchId: string,
    body: {
      bookingId: string;
      requestType: string;
      details?: string;
      assignedEmployeeId?: string;
    },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: body.bookingId, branchId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found in this branch');
      }

      if (booking.status !== 'checked_in') {
        throw new BadRequestException('Guest must be checked in to log requests');
      }

      if (body.assignedEmployeeId) {
        const emp = await tx.employee.findFirst({
          where: { id: body.assignedEmployeeId, branchId },
        });
        if (!emp) {
          throw new NotFoundException('Assigned employee not found');
        }
      }

      const req = await tx.serviceRequest.create({
        data: {
          tenantId,
          branchId,
          bookingId: body.bookingId,
          requestType: body.requestType,
          details: body.details,
          assignedEmployeeId: body.assignedEmployeeId || null,
          status: body.assignedEmployeeId ? 'assigned' : 'pending',
        },
        include: {
          booking: {
            include: {
              guest: true,
              room: true,
            },
          },
          assignedEmployee: true,
        },
      });

      this.gateway.broadcastRequest(branchId, 'service_request_created', req);
      return req;
    });
  }

  async findAll(
    tenantId: string,
    branchId: string,
    filters: {
      status?: string;
      requestType?: string;
      assignedEmployeeId?: string;
    },
  ) {
    const whereClause: any = { tenantId, branchId };
    if (filters.status) whereClause.status = filters.status;
    if (filters.requestType) whereClause.requestType = filters.requestType;
    if (filters.assignedEmployeeId) {
      whereClause.assignedEmployeeId = filters.assignedEmployeeId === 'null' ? null : filters.assignedEmployeeId;
    }

    return this.prisma.serviceRequest.findMany({
      where: whereClause,
      include: {
        booking: {
          include: {
            guest: true,
            room: true,
          },
        },
        assignedEmployee: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assign(tenantId: string, branchId: string, id: string, employeeId: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const request = await tx.serviceRequest.findFirst({
        where: { id, branchId },
      });

      if (!request) {
        throw new NotFoundException('Service request not found');
      }

      if (request.status === 'completed' || request.status === 'cancelled') {
        throw new BadRequestException('Cannot assign a closed request');
      }

      const employee = await tx.employee.findFirst({
        where: { id: employeeId, branchId },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      const updated = await tx.serviceRequest.update({
        where: { id },
        data: {
          assignedEmployeeId: employeeId,
          status: 'assigned',
        },
        include: {
          booking: {
            include: {
              guest: true,
              room: true,
            },
          },
          assignedEmployee: true,
        },
      });

      this.gateway.broadcastRequest(branchId, 'service_request_updated', updated);
      return updated;
    });
  }

  async complete(tenantId: string, branchId: string, id: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const request = await tx.serviceRequest.findFirst({
        where: { id, branchId },
      });

      if (!request) {
        throw new NotFoundException('Service request not found');
      }

      const updated = await tx.serviceRequest.update({
        where: { id },
        data: { status: 'completed' },
        include: {
          booking: {
            include: {
              guest: true,
              room: true,
            },
          },
          assignedEmployee: true,
        },
      });

      this.gateway.broadcastRequest(branchId, 'service_request_updated', updated);
      return updated;
    });
  }

  async cancel(tenantId: string, branchId: string, id: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const request = await tx.serviceRequest.findFirst({
        where: { id, branchId },
      });

      if (!request) {
        throw new NotFoundException('Service request not found');
      }

      const updated = await tx.serviceRequest.update({
        where: { id },
        data: { status: 'cancelled' },
        include: {
          booking: {
            include: {
              guest: true,
              room: true,
            },
          },
          assignedEmployee: true,
        },
      });

      this.gateway.broadcastRequest(branchId, 'service_request_updated', updated);
      return updated;
    });
  }
}
