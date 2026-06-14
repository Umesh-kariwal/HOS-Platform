import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessageService } from './message.service';

@Controller('messaging')
@UseGuards(AuthGuard('jwt'))
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  async sendMessage(
    @Request() req: any,
    @Body()
    body: {
      recipientId?: string;
      recipientRole?: string;
      content: string;
    },
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    const senderId = req.user.employeeId;

    if (!body.content || body.content.trim().length === 0) {
      throw new BadRequestException('Content is required');
    }

    return this.messageService.create(tenantId, branchId, senderId, body);
  }

  @Get('conversations')
  async getConversations(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    const employeeId = req.user.employeeId;

    return this.messageService.getConversationsList(tenantId, branchId, employeeId);
  }

  @Get('conversation/:otherEmployeeId')
  async getConversation(
    @Request() req: any,
    @Param('otherEmployeeId') otherEmployeeId: string,
  ) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    const employeeId = req.user.employeeId;

    return this.messageService.getConversation(
      tenantId,
      branchId,
      employeeId,
      otherEmployeeId,
    );
  }

  @Patch(':id/read')
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    const branchId = req.user.branchId;
    const employeeId = req.user.employeeId;

    return this.messageService.markAsRead(tenantId, branchId, id, employeeId);
  }
}
