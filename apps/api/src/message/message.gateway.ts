import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  namespace: 'messaging',
  cors: {
    origin: '*',
  },
})
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        client.disconnect();
        return;
      }
      const secret = process.env.JWT_SECRET || 'hos_super_secret_key_2026_jwt';
      const decoded = jwt.verify(token as string, secret) as any;
      client.data = {
        employeeId: decoded.employeeId,
        tenantId: decoded.tenantId,
        branchId: decoded.branchId,
        role: decoded.role,
      };

      // Join rooms
      client.join(`branch_${decoded.branchId}`);
      client.join(`employee_${decoded.employeeId}`);
      if (decoded.role) {
        client.join(`role_${decoded.role}`);
      }

      console.log(`[WS-Messaging] Client ${client.id} authenticated for employee ${decoded.employeeId}`);
    } catch (err: any) {
      console.error('[WS-Messaging] Handshake auth error:', err.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[WS-Messaging] Client ${client.id} disconnected`);
  }

  sendPrivateMessage(_branchId: string, recipientId: string, payload: any) {
    if (this.server) {
      this.server.to(`employee_${recipientId}`).emit('message', payload);
      this.server.to(`employee_${payload.senderId}`).emit('message', payload); // Emit to sender too
      console.log(`[WS-Messaging] Sent private message to employee_${recipientId}`);
    }
  }

  sendRoleMessage(_branchId: string, roleName: string, payload: any) {
    if (this.server) {
      this.server.to(`role_${roleName}`).emit('message', payload);
      console.log(`[WS-Messaging] Broadcasted role message to role_${roleName}`);
    }
  }

  sendBranchMessage(branchId: string, payload: any) {
    if (this.server) {
      this.server.to(`branch_${branchId}`).emit('message', payload);
      console.log(`[WS-Messaging] Broadcasted general branch message to branch_${branchId}`);
    }
  }
}
