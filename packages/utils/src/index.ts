export function formatSchemaName(tenantId: string): string {
  return `tenant_${tenantId.replace(/-/g, '_')}`;
}

export function isValidDateRange(checkIn: string, checkOut: string): boolean {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return false;
  }
  
  return checkOutDate.getTime() > checkInDate.getTime();
}

export function computeNights(checkIn: string, checkOut: string): number {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  const diffTime = checkOutDate.getTime() - checkInDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
