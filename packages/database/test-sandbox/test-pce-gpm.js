const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../../../apps/api/dist/app.module');
const { PropertiesController } = require('../../../apps/api/dist/properties/properties.controller');
const { GuestsController } = require('../../../apps/api/dist/guests/guests.controller');
const { RoomsController } = require('../../../apps/api/dist/rooms/rooms.controller');

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
  console.log('         HOS PCE & GPM BACKEND INTEGRATION VALIDATION');
  console.log('================================================================');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  
  const propertiesController = app.get(PropertiesController);
  const guestsController = app.get(GuestsController);
  const roomsController = app.get(RoomsController);

  // ----------------------------------------------------------------
  // 1. PROPERTIES (BRANCHES) ENDPOINTS
  // ----------------------------------------------------------------
  console.log('\n--- 1. Testing Properties (Branches) Controller ---');
  
  console.log('Listing existing properties...');
  const initialProperties = await propertiesController.getProperties(MOCK_REQ);
  console.log(`-> Success! Found ${initialProperties.length} properties.`);
  initialProperties.forEach(p => console.log(`   Property: ${p.name} (${p.currency})`));

  console.log('Creating a new property "Suburban Lodge"...');
  const newProperty = await propertiesController.createProperty(MOCK_REQ, {
    name: 'Suburban Lodge',
    timezone: 'America/New_York',
    currency: 'USD'
  });
  console.log(`-> Success! Created property with ID: ${newProperty.id}`);

  const updatedProperties = await propertiesController.getProperties(MOCK_REQ);
  console.log(`-> Verify: Now we have ${updatedProperties.length} properties.`);
  if (!updatedProperties.some(p => p.id === newProperty.id)) {
    throw new Error('New property was not found in properties list.');
  }

  // ----------------------------------------------------------------
  // 2. GUEST PROFILE MANAGER (GPM) ENDPOINTS
  // ----------------------------------------------------------------
  console.log('\n--- 2. Testing Guests Controller ---');

  console.log('Creating a new guest "Alice Smith"...');
  const newGuest = await guestsController.createGuest(MOCK_REQ, {
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice.smith@gmail.com',
    phone: '+15551234567',
    profileMetadata: { vip: true }
  });
  console.log(`-> Success! Created guest with ID: ${newGuest.id}`);

  console.log('Fetching guest details by ID...');
  const fetchedGuest = await guestsController.getGuestById(newGuest.id, MOCK_REQ);
  console.log(`-> Success! Fetched: ${fetchedGuest.firstName} ${fetchedGuest.lastName} (${fetchedGuest.email})`);
  if (fetchedGuest.profileMetadata?.vip !== true) {
    throw new Error('Guest profile metadata VIP flag mismatch.');
  }

  console.log('Updating guest profile details...');
  const updatedGuest = await guestsController.updateGuest(newGuest.id, MOCK_REQ, {
    lastName: 'Jones',
    phone: '+15559876543'
  });
  console.log(`-> Success! Updated last name to: ${updatedGuest.lastName}`);

  console.log('Searching/listing guests...');
  const searchResults = await guestsController.getGuests(MOCK_REQ, 'Jones');
  console.log(`-> Success! Search for "Jones" returned ${searchResults.length} results.`);
  if (!searchResults.some(g => g.id === newGuest.id)) {
    throw new Error('Updated guest was not found in search results.');
  }

  // ----------------------------------------------------------------
  // 3. PROPERTY CONFIGURATION ENGINE (PCE) ROOMS/TYPES/FLOORS
  // ----------------------------------------------------------------
  console.log('\n--- 3. Testing Rooms, Types & Floors Config Controller ---');

  console.log('Creating a new room type "SUITE"...');
  const newRoomType = await roomsController.createRoomType(MOCK_REQ, {
    code: 'STE',
    name: 'Executive Suite',
    rackRate: 250.00,
    maxOccupancy: 4,
    cleaningDurationMinutes: 60
  });
  console.log(`-> Success! Created Room Type: ${newRoomType.name} (Code: ${newRoomType.code})`);

  console.log('Listing room types...');
  const roomTypes = await roomsController.getRoomTypes(MOCK_REQ);
  console.log(`-> Success! Found ${roomTypes.length} room types.`);
  roomTypes.forEach(rt => console.log(`   Type: ${rt.name} (Rate: $${rt.rackRate})`));

  console.log('Creating a new floor "Second Floor"...');
  const newFloor = await roomsController.createFloor(MOCK_REQ, {
    name: 'Second Floor',
    floorNumber: 2
  });
  console.log(`-> Success! Created Floor with ID: ${newFloor.id}`);

  console.log('Listing floors...');
  const floors = await roomsController.getFloors(MOCK_REQ);
  console.log(`-> Success! Found ${floors.length} floors.`);
  floors.forEach(f => console.log(`   Floor ${f.floorNumber}: ${f.name}`));

  console.log('Creating a new room "201" assigned to Floor 2 and Suite type...');
  const newRoom = await roomsController.createRoom(MOCK_REQ, {
    roomNumber: '201',
    roomTypeId: newRoomType.id,
    floorId: newFloor.id
  });
  console.log(`-> Success! Created room ${newRoom.roomNumber} with physicalStatus: ${newRoom.physicalStatus}`);

  console.log('Listing rooms to verify creation...');
  const rooms = await roomsController.getRooms(MOCK_REQ);
  console.log(`-> Success! Found ${rooms.length} rooms.`);
  const foundRoom = rooms.find(r => r.id === newRoom.id);
  if (!foundRoom) {
    throw new Error('New room was not found in rooms list.');
  }
  console.log(`   Verified Room: ${foundRoom.roomNumber} is on ${foundRoom.floor.name} and has type ${foundRoom.roomType.name}`);

  await app.close();
  console.log('\n================================================================');
  console.log('   🎉 ALL PCE & GPM CONTROLLERS VALIDATIONS PASSED! 🎉');
  console.log('================================================================');
}

test().catch((err) => {
  console.error('\n❌ VALIDATION TEST FAILED:', err.message);
  process.exit(1);
});
