const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:SecurePassword123@127.0.0.1:5432/hos_catalog?schema=catalog"
    }
  }
});

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000002';
const FLOOR_ID = '00000000-0000-0000-0000-000000000003';

const ROLE_MANAGER_ID = '33333333-3333-3333-3333-333333333331';
const ROLE_RECEPTION_ID = '33333333-3333-3333-3333-333333333332';

const TYPE_STD_ID = '44444444-4444-4444-4444-444444444441';
const TYPE_DLX_ID = '44444444-4444-4444-4444-444444444442';

const EMP_MGR_ID = '11111111-1111-1111-1111-111111111111';
const EMP_REC_ID = '11111111-1111-1111-1111-111111111112';

const PASSWORD_HASH = '$2b$10$VnkBXXLuLFouJ3yXFfjn2O.bziy.vd5SNO5Wp33aV3rpmb4iqg1dm'; // 'SecurePassword123'

async function main() {
  console.log('--- SEEDING PILOT PROPERTY DATA ---');

  // Delete existing records to ensure clean idempotent run
  // Delete order matches child-parent relationships
  console.log('Cleaning up existing records...');
  await prisma.booking.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.nightAuditCheckpoint.deleteMany();
  await prisma.propertyDate.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.role.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.tenant.deleteMany();

  // 1. Create Tenant
  console.log('Creating Tenant...');
  await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: 'Pilot Tenant'
    }
  });

  // 2. Create Branch
  console.log('Creating Branch...');
  await prisma.branch.create({
    data: {
      id: BRANCH_ID,
      tenantId: TENANT_ID,
      name: 'Pilot Hotel'
    }
  });

  // 3. Create Roles
  console.log('Creating Roles...');
  await prisma.role.create({
    data: {
      id: ROLE_MANAGER_ID,
      tenantId: TENANT_ID,
      name: 'Manager'
    }
  });
  await prisma.role.create({
    data: {
      id: ROLE_RECEPTION_ID,
      tenantId: TENANT_ID,
      name: 'Front Desk'
    }
  });

  // 4. Create Employees
  console.log('Creating Employees...');
  await prisma.employee.create({
    data: {
      id: EMP_MGR_ID,
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      roleId: ROLE_MANAGER_ID,
      firstName: 'Pilot',
      lastName: 'Manager',
      email: 'manager@pilot.com',
      passwordHash: PASSWORD_HASH,
      isActive: true
    }
  });
  await prisma.employee.create({
    data: {
      id: EMP_REC_ID,
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      roleId: ROLE_RECEPTION_ID,
      firstName: 'Pilot',
      lastName: 'Receptionist',
      email: 'receptionist@pilot.com',
      passwordHash: PASSWORD_HASH,
      isActive: true
    }
  });

  // 5. Create Floor
  console.log('Creating Floor...');
  await prisma.floor.create({
    data: {
      id: FLOOR_ID,
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      name: 'First Floor',
      floorNumber: 1
    }
  });

  // 6. Create Room Types
  console.log('Creating Room Types...');
  await prisma.roomType.create({
    data: {
      id: TYPE_STD_ID,
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      code: 'STD',
      name: 'Standard Room',
      rackRate: 100.00,
      maxOccupancy: 2,
      cleaningDurationMinutes: 30
    }
  });
  await prisma.roomType.create({
    data: {
      id: TYPE_DLX_ID,
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      code: 'DLX',
      name: 'Deluxe Room',
      rackRate: 150.00,
      maxOccupancy: 4,
      cleaningDurationMinutes: 45
    }
  });

  // 7. Create 5 Rooms
  console.log('Creating Rooms...');
  const rooms = [
    { id: '55555555-5555-5555-5555-555555555551', roomNumber: '101', roomTypeId: TYPE_STD_ID },
    { id: '55555555-5555-5555-5555-555555555552', roomNumber: '102', roomTypeId: TYPE_STD_ID },
    { id: '55555555-5555-5555-5555-555555555553', roomNumber: '103', roomTypeId: TYPE_STD_ID },
    { id: '55555555-5555-5555-5555-555555555554', roomNumber: '104', roomTypeId: TYPE_DLX_ID },
    { id: '55555555-5555-5555-5555-555555555555', roomNumber: '105', roomTypeId: TYPE_DLX_ID }
  ];

  for (const r of rooms) {
    await prisma.room.create({
      data: {
        id: r.id,
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        floorId: FLOOR_ID,
        roomTypeId: r.roomTypeId,
        roomNumber: r.roomNumber,
        physicalStatus: 'clean',
        occupancyStatus: 'vacant'
      }
    });
  }

  console.log('--- PILOT SEEDING COMPLETED SUCCESSFULLY ---');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
