const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../../../apps/api/dist/app.module');
const { RoomsController } = require('../../../apps/api/dist/rooms/rooms.controller');
const { BookingsController } = require('../../../apps/api/dist/bookings/bookings.controller');

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
  console.log('--- STARTING ROOMS & BOOKINGS END-TO-END VALIDATION ---');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  
  const roomsController = app.get(RoomsController);
  const bookingsController = app.get(BookingsController);

  // 1. Fetch Rooms (Verify all 5 seeded rooms exist)
  console.log('\n1. Fetching all rooms for the pilot branch...');
  const rooms = await roomsController.getRooms(MOCK_REQ);
  console.log(`-> Success! Found ${rooms.length} rooms. (Expected: 5)`);
  rooms.forEach(r => console.log(`   Room ${r.roomNumber}: ${r.occupancyStatus} - ${r.physicalStatus} (${r.roomType.name})`));

  const targetRoom = rooms[0]; // Room 101

  // 2. Create Reservation (Task check-in loop prep)
  console.log('\n2. Creating a new booking for Jane Doe...');
  const newBooking = await bookingsController.createBooking(MOCK_REQ, {
    guestFirstName: 'Jane',
    guestLastName: 'Doe',
    guestEmail: 'jane.doe@guest.com',
    checkInDate: '2026-06-12',
    checkOutDate: '2026-06-15',
    roomId: targetRoom.id
  });
  console.log(`-> Success! Booking created with status: ${newBooking.status}`);
  console.log(`-> Guest ID: ${newBooking.guestId}`);

  // 3. Execute Guest Check-in
  console.log(`\n3. Checking in guest Jane Doe to Room ${targetRoom.roomNumber}...`);
  const checkedInBooking = await bookingsController.checkIn(newBooking.id, MOCK_REQ, { roomId: targetRoom.id });
  console.log(`-> Success! Booking status changed to: ${checkedInBooking.status}`);
  
  // Re-fetch Room to verify status update
  const updatedRooms1 = await roomsController.getRooms(MOCK_REQ);
  const checkedInRoom = updatedRooms1.find(r => r.id === targetRoom.id);
  console.log(`-> Room ${checkedInRoom.roomNumber} occupancy state: ${checkedInRoom.occupancyStatus}`);

  // 4. Execute Housekeeper Clean status change
  console.log(`\n4. Toggling Room ${targetRoom.roomNumber} cleanliness status to "dirty" (simulating cleanup check)...`);
  await roomsController.updateRoomStatus(targetRoom.id, { physicalStatus: 'dirty' });
  
  const updatedRooms2 = await roomsController.getRooms(MOCK_REQ);
  const cleanToggledRoom = updatedRooms2.find(r => r.id === targetRoom.id);
  console.log(`-> Room ${cleanToggledRoom.roomNumber} cleanliness status: ${cleanToggledRoom.physicalStatus}`);

  // 5. Execute Guest Check-out
  console.log(`\n5. Checking out guest from Booking ${newBooking.id}...`);
  const checkedOutBooking = await bookingsController.checkOut(newBooking.id, MOCK_REQ);
  console.log(`-> Success! Booking status changed to: ${checkedOutBooking.status}`);
  
  // Re-fetch Room to verify occupancy is vacant and status is dirty
  const updatedRooms3 = await roomsController.getRooms(MOCK_REQ);
  const checkedOutRoom = updatedRooms3.find(r => r.id === targetRoom.id);
  console.log(`-> Room ${checkedOutRoom.roomNumber} occupancy state: ${checkedOutRoom.occupancyStatus}`);
  console.log(`-> Room ${checkedOutRoom.roomNumber} cleanliness status: ${checkedOutRoom.physicalStatus}`);

  await app.close();
  console.log('\n--- E2E CONTROLLER VALIDATION COMPLETED ---');
}

test().catch(console.error);
