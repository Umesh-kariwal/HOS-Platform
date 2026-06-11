const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../../../apps/api/dist/app.module');
const { BookingsController } = require('../../../apps/api/dist/bookings/bookings.controller');
const { FoliosController } = require('../../../apps/api/dist/folios/folios.controller');
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
  console.log('        HOS FLB FOLIO, LEDGER & BILLING INTEGRATION TEST');
  console.log('================================================================');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  
  const bookingsController = app.get(BookingsController);
  const foliosController = app.get(FoliosController);
  const roomsController = app.get(RoomsController);
  const prisma = app.get(PrismaService);

  // 1. Setup Test Data (Room Type, Floor, Room, Guest, Booking)
  console.log('\n--- 1. Setting up Test Data ---');
  const code = 'FLB-' + Math.floor(Math.random() * 10000);
  const roomType = await roomsController.createRoomType(MOCK_REQ, {
    code,
    name: 'Luxury King Bed',
    rackRate: 200.00,
    maxOccupancy: 2,
    cleaningDurationMinutes: 45
  });
  console.log(`Created Room Type: ${roomType.name}`);

  const floorNumber = Math.floor(Math.random() * 1000) + 110;
  const floor = await roomsController.createFloor(MOCK_REQ, {
    name: `Floor ${floorNumber}`,
    floorNumber
  });
  console.log(`Created Floor: ${floor.name}`);

  const room = await roomsController.createRoom(MOCK_REQ, {
    roomNumber: `R-${floorNumber}01`,
    roomTypeId: roomType.id,
    floorId: floor.id
  });
  console.log(`Created Room: ${room.roomNumber}`);

  const checkInDate = '2026-08-01';
  const checkOutDate = '2026-08-02';

  // Create Booking (which automatically spawns a primary folio)
  const booking = await bookingsController.createBooking(MOCK_REQ, {
    guestFirstName: 'Billing',
    guestLastName: 'Tester',
    guestEmail: 'billing.tester@gmail.com',
    checkInDate,
    checkOutDate,
    roomId: room.id
  });
  console.log(`Booking Created: ID ${booking.id} for Room ${booking.room.roomNumber}`);

  // 2. Fetch booking folios
  console.log('\n--- 2. Fetching Booking Folios ---');
  const folios = await bookingsController.getFolios(booking.id, MOCK_REQ);
  console.log(`Found ${folios.length} folio(s) for booking.`);
  const folioA = folios[0];
  console.log(`Folio A (Primary) ID: ${folioA.id} | Payer: ${folioA.payerType} | Status: ${folioA.status}`);
  if (folios.length !== 1) {
    throw new Error('Expected exactly 1 default folio');
  }

  // 3. Post charge directly to Folio A
  console.log('\n--- 3. Posting Charge to Folio A (No Routing Rule) ---');
  const chargeAmount = 120.00;
  const chargeEntry1 = await foliosController.postCharge(folioA.id, MOCK_REQ, {
    amount: chargeAmount,
    description: 'Room Night Rate Charge',
    category: 'room_charge'
  });
  console.log(`Success! Posted charge: ID ${chargeEntry1.id} | Folio: ${chargeEntry1.folioId} | Amount: $${chargeEntry1.amount} | Type: ${chargeEntry1.type}`);
  if (chargeEntry1.folioId !== folioA.id) {
    throw new Error('Charge should be on Folio A');
  }

  // 4. Create Folio B (Secondary Folio) for extras
  console.log('\n--- 4. Creating Folio B (Secondary) and Billing Routing Rule ---');
  const folioB = await prisma.client.folio.create({
    data: {
      tenantId: TENANT_ID,
      bookingId: booking.id,
      payerType: 'guest',
      payerGuestId: booking.guestId,
      status: 'open'
    }
  });
  console.log(`Folio B ID: ${folioB.id}`);

  // Create a billing routing rule: all 'food_and_beverage' charges should go to Folio B
  const routingRule = await foliosController.createRoutingRule(folioA.id, MOCK_REQ, {
    chargeCategory: 'food_and_beverage',
    splitType: 'flat',
    value: 1.00,
    targetFolioId: folioB.id
  });
  console.log(`Created Routing Rule: Route category "${routingRule.chargeCategory}" to Folio ${routingRule.targetFolioId}`);

  // 5. Post charge that matches the routing rule
  console.log('\n--- 5. Posting Routed Charge (Category: food_and_beverage) ---');
  const fnbAmount = 45.50;
  const chargeEntry2 = await foliosController.postCharge(folioA.id, MOCK_REQ, {
    amount: fnbAmount,
    description: 'Restaurant Dinner Charge',
    category: 'food_and_beverage'
  });
  console.log(`Success! Posted charge: ID ${chargeEntry2.id} | Folio: ${chargeEntry2.folioId} (Routed!) | Original Folio (sourceFolioId): ${chargeEntry2.sourceFolioId}`);
  
  if (chargeEntry2.folioId !== folioB.id) {
    throw new Error('Charge should have been routed to Folio B');
  }
  if (chargeEntry2.sourceFolioId !== folioA.id) {
    throw new Error('sourceFolioId should track the origin Folio A');
  }

  // 6. Post payment asynchronously to Folio A
  console.log('\n--- 6. Posting Payment to Folio A (Async Queue Mock) ---');
  const paymentAmount = 120.00;
  const paymentResponse = await foliosController.postPayment(folioA.id, MOCK_REQ, {
    amount: paymentAmount,
    description: 'Visa Payment'
  });
  console.log(`Payment Response:`, paymentResponse);
  if (paymentResponse.status !== 'processing') {
    throw new Error('Expected payment response to be processing');
  }

  console.log('Waiting 1200ms for background Async Payment Queue to process and settle...');
  await new Promise(resolve => setTimeout(resolve, 1200));

  // 7. Verify Folios Balances
  console.log('\n--- 7. Verifying Folios Summaries and Balances ---');
  const summaryA = await foliosController.getFolioById(folioA.id, MOCK_REQ);
  console.log(`Folio A Summary:`);
  console.log(`   Total Charges:  $${summaryA.totalCharges}`);
  console.log(`   Total Payments: $${summaryA.totalPayments}`);
  console.log(`   Balance:        $${summaryA.balance}`);
  
  if (summaryA.totalCharges !== 120.00) {
    throw new Error(`Folio A charges mismatch, expected 120.00, got ${summaryA.totalCharges}`);
  }
  if (summaryA.totalPayments !== 120.00) {
    throw new Error(`Folio A payments mismatch, expected 120.00, got ${summaryA.totalPayments}`);
  }
  if (summaryA.balance !== 0.00) {
    throw new Error(`Folio A balance mismatch, expected 0.00, got ${summaryA.balance}`);
  }

  const summaryB = await foliosController.getFolioById(folioB.id, MOCK_REQ);
  console.log(`Folio B Summary:`);
  console.log(`   Total Charges:  $${summaryB.totalCharges}`);
  console.log(`   Total Payments: $${summaryB.totalPayments}`);
  console.log(`   Balance:        $${summaryB.balance}`);

  if (summaryB.totalCharges !== 45.50) {
    throw new Error(`Folio B charges mismatch, expected 45.50, got ${summaryB.totalCharges}`);
  }
  if (summaryB.totalPayments !== 0.00) {
    throw new Error(`Folio B payments mismatch, expected 0.00, got ${summaryB.totalPayments}`);
  }
  if (summaryB.balance !== 45.50) {
    throw new Error(`Folio B balance mismatch, expected 45.50, got ${summaryB.balance}`);
  }

  await app.close();
  console.log('\n================================================================');
  console.log('      🎉 ALL FLB LEDGER & BILLING OPERATIONS PASSED! 🎉');
  console.log('================================================================');
}

test().catch((err) => {
  console.error('\n❌ VALIDATION TEST FAILED:', err);
  process.exit(1);
});
