const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../../../apps/api/dist/app.module');
const { BookingsController } = require('../../../apps/api/dist/bookings/bookings.controller');
const { InventoryController } = require('../../../apps/api/dist/inventory/inventory.controller');
const { RoomsController } = require('../../../apps/api/dist/rooms/rooms.controller');
const { PrismaService } = require('../../../apps/api/dist/prisma/prisma.service');

process.env.DATABASE_URL = "postgresql://postgres:SecurePassword123@127.0.0.1:5432/hos_catalog?schema=catalog";

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000002';
const MOCK_REQ = {
  user: {
    employeeId: '11111111-1111-1111-1111-111111111112',
    tenantId: TENANT_ID,
    role: '33333333-3333-3333-3333-333333333332',
    branchId: BRANCH_ID
  }
};

async function test() {
  console.log('================================================================');
  console.log('       HOS RIE OVERBOOKING & INVENTORY INTEGRATION TEST');
  console.log('================================================================');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  
  const bookingsController = app.get(BookingsController);
  const inventoryController = app.get(InventoryController);
  const roomsController = app.get(RoomsController);
  const prisma = app.get(PrismaService);

  // 1. Setup Test Data (Room Type and Rooms)
  console.log('\n--- 1. Setting up Room Type and Rooms for Test ---');
  const code = 'DBL-' + Math.floor(Math.random() * 10000);
  const roomType = await roomsController.createRoomType(MOCK_REQ, {
    code,
    name: 'Double Comfort Room',
    rackRate: 150.00,
    maxOccupancy: 2,
    cleaningDurationMinutes: 30
  });
  console.log(`Created Room Type: ${roomType.name} (${roomType.code})`);

  // Create Floor
  const floorNumber = Math.floor(Math.random() * 1000) + 10;
  const floor = await roomsController.createFloor(MOCK_REQ, {
    name: `Floor ${floorNumber}`,
    floorNumber
  });
  console.log(`Created Floor: ${floor.name}`);

  // Create 2 rooms
  const room301 = await roomsController.createRoom(MOCK_REQ, {
    roomNumber: `R-${floorNumber}01`,
    roomTypeId: roomType.id,
    floorId: floor.id
  });
  const room302 = await roomsController.createRoom(MOCK_REQ, {
    roomNumber: `R-${floorNumber}02`,
    roomTypeId: roomType.id,
    floorId: floor.id
  });
  console.log(`Created Room ${room301.roomNumber} (ID: ${room301.id})`);
  console.log(`Created Room ${room302.roomNumber} (ID: ${room302.id})`);

  const startDate = '2026-07-01';
  const endDate = '2026-07-03';

  // 2. Query initial availability
  console.log('\n--- 2. Checking Initial Availability ---');
  let avail = await inventoryController.getAvailability(MOCK_REQ, startDate, endDate, roomType.id);
  console.log(`Availability Query Range: ${startDate} to ${endDate}`);
  console.log(`Total Room Type ${roomType.code} Rooms: ${avail.roomTypes[0].totalRooms}`);
  avail.roomTypes[0].days.forEach(d => {
    console.log(`   Date: ${d.date} | Total: ${d.totalPhysical} | Sold: ${d.soldQty} | Available: ${d.availableQty}`);
  });
  console.log(`Available Rooms in range:`, avail.availableRooms.map(r => r.roomNumber));
  
  if (avail.roomTypes[0].totalRooms !== 2) {
    throw new Error('Total rooms should be 2');
  }
  if (avail.availableRooms.length !== 2) {
    throw new Error('Both rooms should be available');
  }

  // 3. Create a normal booking for Room 301
  console.log('\n--- 3. Creating Booking for Room 301 ---');
  const booking1 = await bookingsController.createBooking(MOCK_REQ, {
    guestFirstName: 'Test',
    guestLastName: 'Guest 1',
    guestEmail: 'test.guest1@gmail.com',
    checkInDate: startDate,
    checkOutDate: endDate,
    roomId: room301.id
  });
  console.log(`Booking 1 Created: ID ${booking1.id} for Room ${booking1.room.roomNumber}`);

  // Query availability again
  console.log('\nChecking Availability after Booking 1...');
  avail = await inventoryController.getAvailability(MOCK_REQ, startDate, endDate, roomType.id);
  avail.roomTypes[0].days.forEach(d => {
    console.log(`   Date: ${d.date} | Total: ${d.totalPhysical} | Sold: ${d.soldQty} | Available: ${d.availableQty}`);
    if (d.soldQty !== 1 || d.availableQty !== 1) {
      throw new Error(`Inventory snapshot mismatch on ${d.date}. Sold: ${d.soldQty}, Available: ${d.availableQty}`);
    }
  });
  console.log(`Available Rooms now:`, avail.availableRooms.map(r => r.roomNumber));
  if (avail.availableRooms.includes(room301.roomNumber)) {
    throw new Error('Room 301 should not be listed as available');
  }

  // Verify DB snapshot table directly
  console.log('\nVerifying DB InventorySnapshot table...');
  const snapshots = await prisma.inventorySnapshot.findMany({
    where: {
      tenantId: TENANT_ID,
      roomTypeId: roomType.id,
      snapshotDate: {
        gte: new Date(startDate),
        lt: new Date(endDate)
      }
    }
  });
  console.log(`Found ${snapshots.length} snapshot records in DB.`);
  snapshots.forEach(s => {
    console.log(`   DB Record: Date: ${s.snapshotDate.toISOString().split('T')[0]} | Sold: ${s.soldQty} | Avail: ${s.availableQty}`);
  });
  if (snapshots.length !== 2) {
    throw new Error('Expected 2 snapshot records in DB');
  }

  // 4. Test Overbooking Prevention (Synchronous rejection)
  console.log('\n--- 4. Testing Synchronous Overbooking Prevention ---');
  try {
    console.log(`Attempting to book Room 301 again for overlapping dates...`);
    await bookingsController.createBooking(MOCK_REQ, {
      guestFirstName: 'Test',
      guestLastName: 'Guest 2',
      guestEmail: 'test.guest2@gmail.com',
      checkInDate: startDate,
      checkOutDate: endDate,
      roomId: room301.id
    });
    throw new Error('FAILED: Overbooking request was allowed!');
  } catch (err) {
    console.log(`-> Success! Overbooking request rejected as expected: "${err.message}"`);
    if (err.status !== 409) {
      throw new Error('Expected 409 ConflictException');
    }
  }

  // 5. Test Overbooking Prevention (Concurrent Race Conditions)
  console.log('\n--- 5. Testing Concurrent Booking Race Condition (FOR UPDATE verification) ---');
  console.log(`Firing 2 concurrent booking requests for Room 302...`);
  
  const req1 = bookingsController.createBooking(MOCK_REQ, {
    guestFirstName: 'Concurrent',
    guestLastName: 'User A',
    guestEmail: 'user.a@gmail.com',
    checkInDate: startDate,
    checkOutDate: endDate,
    roomId: room302.id
  });

  const req2 = bookingsController.createBooking(MOCK_REQ, {
    guestFirstName: 'Concurrent',
    guestLastName: 'User B',
    guestEmail: 'user.b@gmail.com',
    checkInDate: startDate,
    checkOutDate: endDate,
    roomId: room302.id
  });

  const results = await Promise.allSettled([req1, req2]);
  
  let successCount = 0;
  let failureCount = 0;
  let failureMessage = '';

  results.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      successCount++;
      console.log(`   Request ${i + 1} Succeeded: Booking ID ${res.value.id}`);
    } else {
      failureCount++;
      failureMessage = res.reason.message;
      console.log(`   Request ${i + 1} Failed: "${res.reason.message}" (Status: ${res.reason.status})`);
    }
  });

  console.log(`Concurrent Results: Successes: ${successCount} | Failures: ${failureCount}`);
  if (successCount !== 1 || failureCount !== 1) {
    throw new Error(`Concurrency check failed! One must succeed and one must fail. Successes: ${successCount}, Failures: ${failureCount}`);
  }
  console.log(`-> Success! Race condition safely neutralized by row-level locking.`);

  // 6. Test Check-In / Check-Out operations
  console.log('\n--- 6. Testing Check-in and Check-out ---');
  console.log(`Checking in Booking 1 for Room 301...`);
  const checkinResult = await bookingsController.checkIn(booking1.id, MOCK_REQ, { roomId: room301.id });
  console.log(`-> Success! Booking Status: ${checkinResult.status} | Room Occupancy: ${checkinResult.room.occupancyStatus}`);

  // Verify room occupancy status
  let checkinRoom = await prisma.room.findUnique({ where: { id: room301.id } });
  console.log(`   Room ${checkinRoom.roomNumber} occupancy status in DB: ${checkinRoom.occupancyStatus}`);
  if (checkinRoom.occupancyStatus !== 'occupied') {
    throw new Error('Room should be occupied after check-in');
  }

  console.log(`Checking out Booking 1 from Room 301...`);
  const checkoutResult = await bookingsController.checkOut(booking1.id, MOCK_REQ);
  console.log(`-> Success! Booking Status: ${checkoutResult.status} | Room Occupancy: ${checkoutResult.room.occupancyStatus} | Room Cleanliness: ${checkoutResult.room.physicalStatus}`);

  // Verify room occupancy status and cleanliness
  let checkoutRoom = await prisma.room.findUnique({ where: { id: room301.id } });
  console.log(`   Room ${checkoutRoom.roomNumber} occupancy status in DB: ${checkoutRoom.occupancyStatus}`);
  console.log(`   Room ${checkoutRoom.roomNumber} physical cleanliness status in DB: ${checkoutRoom.physicalStatus}`);
  if (checkoutRoom.occupancyStatus !== 'vacant' || checkoutRoom.physicalStatus !== 'dirty') {
    throw new Error('Room should be vacant and dirty after check-out');
  }

  // Final check of availability snapshots after checkout
  avail = await inventoryController.getAvailability(MOCK_REQ, startDate, endDate, roomType.id);
  console.log('\nFinal Availability checking...');
  avail.roomTypes[0].days.forEach(d => {
    console.log(`   Date: ${d.date} | Total: ${d.totalPhysical} | Sold: ${d.soldQty} | Available: ${d.availableQty}`);
    // Since booking1 is checked_out (inactive), but booking2 (concurrent winner) is active, soldQty should be 1
    if (d.soldQty !== 1) {
      throw new Error(`Expected soldQty to be 1 (only the concurrent winner should remain active), got ${d.soldQty}`);
    }
  });

  await app.close();
  console.log('\n================================================================');
  console.log('    🎉 ALL RIE OVERBOOKING & INVENTORY OPERATIONS PASSED! 🎉');
  console.log('================================================================');
}

test().catch((err) => {
  console.error('\n❌ VALIDATION TEST FAILED:', err);
  process.exit(1);
});
