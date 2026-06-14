import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  namespace: 'dispatch',
  cors: {
    origin: '*',
  },
})
export class DispatchGateway implements OnGatewayConnection, OnGatewayDisconnect {
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
      client.join(`branch_${decoded.branchId}`);
      console.log(`[WS-GSR] Client ${client.id} authenticated for branch ${decoded.branchId}`);
    } catch (err: any) {
      console.error('[WS-GSR] Handshake auth error:', err.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[WS-GSR] Client ${client.id} disconnected`);
  }

  broadcastRequest(branchId: string, eventType: string, payload: any) {
    if (this.server) {
      this.server.to(`branch_${branchId}`).emit(eventType, payload);
      console.log(`[WS-GSR] Broadcasted event ${eventType} to branch_${branchId}`);
    }
  }
}
