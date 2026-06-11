export interface TenantConfig {
  id: string;
  name: string;
  schemaName: string;
  status: 'active' | 'suspended' | 'pending';
}

export interface BranchRouteConfig {
  id: string;
  tenantId: string;
  branchId: string;
  domain: string;
}

export interface CreateBookingDto {
  guestId: string;
  branchId: string;
  roomTypeId: string;
  checkInDate: string; // ISO Date YYYY-MM-DD
  checkOutDate: string; // ISO Date YYYY-MM-DD
}

export interface PostChargeDto {
  category: 'room' | 'f_and_b' | 'spa' | 'laundry' | 'all';
  splitType: 'percentage' | 'fixed';
  amount: number;
  description: string;
  idempotencyKey: string;
}

export interface OfflineAction {
  action: 'check_in' | 'check_out' | 'dirty_room' | 'post_charge';
  deviceId: string;
  payload: Record<string, any>;
  timestamp: string;
}
