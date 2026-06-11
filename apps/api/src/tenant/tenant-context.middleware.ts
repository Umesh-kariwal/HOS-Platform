import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContextStore } from './tenant-context.store';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const headerTenantId = req.headers['x-tenant-id'] as string;
    let tokenTenantId: string | undefined;

    // Extract Bearer token and decode the tenantId
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
          tokenTenantId = decoded.tenantId;
        }
      } catch (err) {
        // Decouple error parsing from validation; formal validation occurs in JwtStrategy
      }
    }

    let resolvedTenantId: string | undefined;

    if (tokenTenantId) {
      // JWT tenantId is the absolute source of truth
      resolvedTenantId = tokenTenantId;

      // If x-tenant-id header is also present, it MUST match the JWT tenantId
      if (headerTenantId && headerTenantId !== tokenTenantId) {
        throw new BadRequestException('Mismatched x-tenant-id and auth token tenant context');
      }
    } else {
      // If there is no token, allow the context to be set from x-tenant-id header (e.g. for unauthenticated paths)
      resolvedTenantId = headerTenantId;
    }

    if (resolvedTenantId) {
      (req as any).tenantId = resolvedTenantId;
      tenantContextStore.run({ tenantId: resolvedTenantId }, () => {
        next();
      });
    } else {
      next();
    }
  }
}
