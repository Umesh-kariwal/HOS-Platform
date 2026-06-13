import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  namespace: 'incidents',
  cors: {
    origin: '*',
  },
})
export class IncidentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    try {
      // Authenticate socket connection using query token or auth object
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

      // Join client to branch-specific WebSocket room
      client.join(`branch_${decoded.branchId}`);
      console.log(`[WS] Client ${client.id} authenticated for branch ${decoded.branchId}`);
    } catch (err: any) {
      console.error('[WS] Handshake auth error:', err.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[WS] Client ${client.id} disconnected`);
  }

  broadcastPanic(branchId: string, panicAlertPayload: any) {
    if (this.server) {
      this.server.to(`branch_${branchId}`).emit('panic_alert', panicAlertPayload);
      console.log(`[WS] Broadcasted panic alert to branch_${branchId}`);
    }
  }
}
