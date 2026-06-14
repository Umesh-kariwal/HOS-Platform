import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageGateway } from './message.gateway';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessageGateway,
  ) {}

  async create(
    tenantId: string,
    branchId: string,
    senderId: string,
    body: {
      recipientId?: string;
      recipientRole?: string;
      content: string;
    },
  ) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      // Create message in database
      const msg = await tx.message.create({
        data: {
          tenantId,
          branchId,
          senderId,
          recipientId: body.recipientId || null,
          recipientRole: body.recipientRole || null,
          content: body.content,
          isRead: false,
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: { select: { name: true } },
            },
          },
          recipient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: { select: { name: true } },
            },
          },
        },
      });

      // Broadcast message via WebSockets
      if (body.recipientId) {
        // Direct private message
        this.gateway.sendPrivateMessage(branchId, body.recipientId, msg);
      } else if (body.recipientRole) {
        // Role-based group message
        this.gateway.sendRoleMessage(branchId, body.recipientRole, msg);
      } else {
        // General branch broadcast
        this.gateway.sendBranchMessage(branchId, msg);
      }

      return msg;
    });
  }

  async getConversation(
    tenantId: string,
    branchId: string,
    employeeId: string,
    otherEmployeeId: string,
  ) {
    return this.prisma.message.findMany({
      where: {
        tenantId,
        branchId,
        OR: [
          { senderId: employeeId, recipientId: otherEmployeeId },
          { senderId: otherEmployeeId, recipientId: employeeId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getConversationsList(tenantId: string, branchId: string, employeeId: string) {
    // Return all staff employees in the branch with their last message if it exists
    const employees = await this.prisma.employee.findMany({
      where: { branchId, tenantId, id: { not: employeeId }, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: { select: { name: true } },
      },
    });

    const listWithMessages = await Promise.all(
      employees.map(async (emp: any) => {
        const lastMsg = await this.prisma.message.findFirst({
          where: {
            tenantId,
            branchId,
            OR: [
              { senderId: employeeId, recipientId: emp.id },
              { senderId: emp.id, recipientId: employeeId },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

        // Unread messages count sent from this specific employee to me
        const unreadCount = await this.prisma.message.count({
          where: {
            tenantId,
            branchId,
            senderId: emp.id,
            recipientId: employeeId,
            isRead: false,
          },
        });

        return {
          employee: emp,
          lastMessage: lastMsg,
          unreadCount,
        };
      }),
    );

    // Sort by last message date desc, then by name
    return listWithMessages.sort((a, b) => {
      if (a.lastMessage && b.lastMessage) {
        return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
      }
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      return a.employee.firstName.localeCompare(b.employee.firstName);
    });
  }

  async markAsRead(tenantId: string, branchId: string, messageId: string, employeeId: string) {
    return this.prisma.runInTenantContext(tenantId, async (tx) => {
      const msg = await tx.message.findFirst({
        where: { id: messageId, branchId, recipientId: employeeId },
      });
      if (!msg) {
        throw new NotFoundException('Message not found or recipient context mismatch');
      }

      const updated = await tx.message.update({
        where: { id: messageId },
        data: { isRead: true },
      });

      return updated;
    });
  }
}
