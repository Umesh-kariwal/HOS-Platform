import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, ip, user } = request;

    return next.handle().pipe(
      tap({
        next: (response) => {
          // If not authenticated or not a write request, skip
          if (!user || !user.tenantId || (method !== 'POST' && method !== 'PUT' && method !== 'PATCH')) {
            return;
          }

          // Match routes and log
          let action = '';
          let entityName = '';
          let entityId = '';

          const path = url.replace('/api/v1', '');

          if (path.startsWith('/bookings')) {
            entityName = 'Booking';
            if (path.endsWith('/check-in')) {
              action = 'check_in';
              entityId = path.split('/')[2];
            } else if (path.endsWith('/check-out')) {
              action = 'check_out';
              entityId = path.split('/')[2];
            } else if (method === 'POST') {
              action = 'create_booking';
              entityId = response?.id || '';
            }
          } else if (path.startsWith('/folios')) {
            entityName = 'Folio';
            entityId = path.split('/')[2] || '';
            if (path.endsWith('/charges')) {
              action = 'post_charge';
            } else if (path.endsWith('/payments')) {
              action = 'post_payment';
            } else if (path.endsWith('/route')) {
              action = 'create_routing_rule';
              entityName = 'BillingRoutingRule';
              entityId = response?.id || '';
            }
          } else if (path.startsWith('/rooms') && path.endsWith('/status')) {
            action = 'change_room_status';
            entityName = 'Room';
            entityId = path.split('/')[2];
          } else if (path.startsWith('/inventory')) {
            entityName = 'Inventory';
            if (path.endsWith('/stock')) {
              action = 'adjust_stock';
              entityId = body.itemId || '';
            } else if (path.endsWith('/minibar/consume')) {
              action = 'minibar_consumption';
              entityId = response?.chargeEntry?.id || '';
            }
          } else if (path.startsWith('/peripherals/incidents/panic')) {
            action = 'trigger_panic';
            entityName = 'IncidentLog';
            entityId = response?.id || '';
          }

          // If matched, write log entry asynchronously
          if (action) {
            this.auditService.create({
              tenantId: user.tenantId,
              actorId: user.employeeId,
              action,
              entityName,
              entityId,
              newValues: body,
              ipAddress: ip || '127.0.0.1',
            }).catch(err => {
              console.error('[Audit Interceptor] Failed to write log:', err.message);
            });
          }
        },
      }),
    );
  }
}
