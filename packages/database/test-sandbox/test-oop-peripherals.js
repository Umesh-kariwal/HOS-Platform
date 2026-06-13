const http = require('http');
const { PrismaClient } = require('@prisma/client');
const io = require('socket.io-client');

// Connect as superuser to verify DB state
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:SecurePassword123@127.0.0.1:5432/hos_catalog?schema=catalog"
    }
  }
});

const API_BASE = 'http://localhost:4000/api/v1';

// Helper for native http requests
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers ? { ...options.headers } : {}
    };
    
    const bodyStr = options.body ? JSON.stringify(options.body) : null;
    if (bodyStr) {
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    } else {
      if (reqOptions.headers && reqOptions.headers['Content-Type']) {
        delete reqOptions.headers['Content-Type'];
      }
      if (options.method === 'POST' || options.method === 'PUT') {
        reqOptions.headers['Content-Length'] = 0;
      }
    }
    
    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const isJson = (res.headers['content-type'] || '').includes('application/json');
        let parsedData = data;
        if (isJson && data.trim().length > 0) {
          try {
            parsedData = JSON.parse(data);
          } catch (e) {
            // keep as string
          }
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsedData
        });
      });
    });
    
    req.on('error', (err) => reject(err));
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function testAll() {
  console.log('================================================================');
  console.log('       HOS MODULE 8: OPERATIONAL PERIPHERALS VALIDATION');
  console.log('================================================================');

  let token = '';
  let authHeaders = {};
  let bookingId = '';
  
  // 1. LOGIN RECEPTIONIST
  console.log('\n--- 1. Login Receptionist ---');
  const loginRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: {
      email: 'receptionist@pilot.com',
      password: 'SecurePassword123'
    }
  });
  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
  }
  token = loginRes.data.token;
  authHeaders = {
    'Authorization': `Bearer ${token}`
  };
  console.log('-> Success! Logged in as receptionist.');

  // Create an active checked-in booking for testing valet/visitors
  console.log('\n--- 2. Setting Up Checked-In Booking ---');
  // Clean up any existing bookings first
  await prisma.valetTicket.deleteMany();
  await prisma.visitorRecord.deleteMany();
  await prisma.lostAndFoundItem.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.guest.deleteMany();

  const bookingRes = await request(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      guestFirstName: 'Alice',
      guestLastName: 'Smith',
      guestEmail: 'alice.smith@gmail.com',
      checkInDate: '2026-06-11',
      checkOutDate: '2026-06-13',
      roomId: '55555555-5555-5555-5555-555555555551' // Room 101
    }
  });
  if (bookingRes.status !== 201) {
    throw new Error(`Booking creation failed: ${JSON.stringify(bookingRes.data)}`);
  }
  bookingId = bookingRes.data.id;
  console.log(`-> Created Booking: ${bookingId}`);

  // Check in the booking
  const checkinRes = await request(`${API_BASE}/bookings/${bookingId}/check-in`, {
    method: 'POST',
    headers: authHeaders,
    body: { roomId: '55555555-5555-5555-5555-555555555551' }
  });
  if (checkinRes.status !== 201) {
    throw new Error(`Check-in failed: ${JSON.stringify(checkinRes.data)}`);
  }
  console.log('-> Success! Booking status set to checked_in.');

  // ==========================================
  // PARKING SLOT TEST
  // ==========================================
  console.log('\n--- 3. Testing Parking Slots ---');
  // Clean up existing parking slots
  await prisma.parkingSlot.deleteMany();

  const createSlotRes = await request(`${API_BASE}/peripherals/parking`, {
    method: 'POST',
    headers: authHeaders,
    body: { slotIdentifier: 'Slot A' }
  });
  console.log('Create Parking Slot response status:', createSlotRes.status);
  if (createSlotRes.status !== 201) {
    throw new Error(`Failed to create parking slot: ${JSON.stringify(createSlotRes.data)}`);
  }
  const parkingSlotId = createSlotRes.data.id;
  console.log(`-> Created Slot: ${createSlotRes.data.slotIdentifier} (ID: ${parkingSlotId})`);

  // Verify Conflict on Duplicate identifier
  const duplicateRes = await request(`${API_BASE}/peripherals/parking`, {
    method: 'POST',
    headers: authHeaders,
    body: { slotIdentifier: 'Slot A' }
  });
  console.log('Duplicate Parking Slot response status:', duplicateRes.status);
  if (duplicateRes.status !== 409) {
    throw new Error('Expected 409 Conflict for duplicate slot identifier.');
  }
  console.log('✅ Duplicate slot rejected correctly (Conflict 409)');

  // Query parking slots
  const getSlotsRes = await request(`${API_BASE}/peripherals/parking`, {
    method: 'GET',
    headers: authHeaders
  });
  if (getSlotsRes.status !== 200 || getSlotsRes.data.length !== 1) {
    throw new Error('Get parking slots query failed.');
  }
  console.log('-> Success! Found parking slot:', getSlotsRes.data[0].slotIdentifier);

  // ==========================================
  // VALET TICKET TEST
  // ==========================================
  console.log('\n--- 4. Testing Valet Ticket Workflow ---');
  const valetRes = await request(`${API_BASE}/peripherals/valet`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      bookingId,
      vehicleLicense: 'XYZ-9876',
      keyTag: 'K-22',
      parkingSlotId
    }
  });
  console.log('Create Valet Ticket response status:', valetRes.status);
  if (valetRes.status !== 201) {
    throw new Error(`Failed to create valet ticket: ${JSON.stringify(valetRes.data)}`);
  }
  const ticketId = valetRes.data.id;
  console.log(`-> Issued Valet Ticket ID: ${ticketId}`);

  // Verify that slot status is now occupied in the DB
  const slotDbState = await prisma.parkingSlot.findUnique({
    where: { id: parkingSlotId }
  });
  console.log('Slot state in DB:', slotDbState.status);
  if (slotDbState.status !== 'occupied') {
    throw new Error('Expected parking slot status to be occupied.');
  }
  console.log('✅ Parking slot marked occupied');

  // Request vehicle
  const reqValetRes = await request(`${API_BASE}/peripherals/valet/${ticketId}/request`, {
    method: 'PATCH',
    headers: authHeaders
  });
  console.log('Request vehicle response status:', reqValetRes.status);
  if (reqValetRes.status !== 200 || reqValetRes.data.status !== 'requested') {
    throw new Error('Vehicle request failed.');
  }
  console.log('✅ Valet ticket status updated to requested');

  // Retrieve vehicle
  const retrieveValetRes = await request(`${API_BASE}/peripherals/valet/${ticketId}/retrieve`, {
    method: 'PATCH',
    headers: authHeaders
  });
  console.log('Retrieve vehicle response status:', retrieveValetRes.status);
  if (retrieveValetRes.status !== 200 || retrieveValetRes.data.status !== 'retrieved') {
    throw new Error('Vehicle retrieval failed.');
  }

  // Verify slot status resets to vacant
  const slotDbStateAfter = await prisma.parkingSlot.findUnique({
    where: { id: parkingSlotId }
  });
  console.log('Slot state after retrieval in DB:', slotDbStateAfter.status);
  if (slotDbStateAfter.status !== 'vacant') {
    throw new Error('Expected parking slot status to return to vacant.');
  }
  console.log('✅ Parking slot reset to vacant');

  // ==========================================
  // VISITOR RECORD HASHING TEST
  // ==========================================
  console.log('\n--- 5. Testing Visitor Hashing & Scoping ---');
  const visitorPayload = {
    bookingId,
    firstName: 'VisitorFirst',
    lastName: 'VisitorLast',
    idNumber: 'DL-998877665544'
  };
  const createVisitorRes = await request(`${API_BASE}/peripherals/visitors`, {
    method: 'POST',
    headers: authHeaders,
    body: visitorPayload
  });
  console.log('Create Visitor response status:', createVisitorRes.status);
  if (createVisitorRes.status !== 201) {
    throw new Error(`Failed to create visitor: ${JSON.stringify(createVisitorRes.data)}`);
  }
  const visitorId = createVisitorRes.data.id;
  console.log(`-> Created Visitor record: ${visitorId}`);

  // Query DB directly to verify plain text ID number is NOT stored, only SHA-256 hash is
  const visitorInDb = await prisma.visitorRecord.findUnique({
    where: { id: visitorId }
  });
  console.log('Raw Visitor Record in DB:', JSON.stringify(visitorInDb, null, 2));

  // Assertions
  if (visitorInDb.idNumber || visitorInDb.rawId || JSON.stringify(visitorInDb).includes(visitorPayload.idNumber)) {
    throw new Error('PII Leak: Plain text document ID was stored in the database!');
  }
  if (!visitorInDb.idHash || visitorInDb.idHash.length !== 64) {
    throw new Error('Expected valid SHA-256 hash in idHash column.');
  }
  console.log('✅ Document ID hashed server-side. Raw PII scrubbed.');

  // Checkout visitor
  const checkoutVisitorRes = await request(`${API_BASE}/peripherals/visitors/${visitorId}/checkout`, {
    method: 'PATCH',
    headers: authHeaders
  });
  console.log('Visitor checkout response status:', checkoutVisitorRes.status);
  if (checkoutVisitorRes.status !== 200 || !checkoutVisitorRes.data.checkOutTime) {
    throw new Error('Visitor checkout failed.');
  }
  console.log('✅ Visitor checked out successfully');

  // ==========================================
  // LOST AND FOUND ITEM TEST
  // ==========================================
  console.log('\n--- 6. Testing Lost & Found ---');
  const lostRes = await request(`${API_BASE}/peripherals/lost-found`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      roomId: '55555555-5555-5555-5555-555555555551',
      description: 'Gold Wedding Ring',
      storageBin: 'Bin B-1'
    }
  });
  console.log('Report Lost Item response status:', lostRes.status);
  if (lostRes.status !== 201) {
    throw new Error(`Report item failed: ${JSON.stringify(lostRes.data)}`);
  }
  const lostItemId = lostRes.data.id;
  console.log(`-> Reported Item: ${lostRes.data.description} (Bin: ${lostRes.data.storageBin})`);

  // Claim item
  const claimRes = await request(`${API_BASE}/peripherals/lost-found/${lostItemId}/claim`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { claimantName: 'Alice Smith' }
  });
  console.log('Claim item response status:', claimRes.status);
  if (claimRes.status !== 200 || claimRes.data.status !== 'claimed' || claimRes.data.claimantName !== 'Alice Smith') {
    throw new Error(`Claim failed: ${JSON.stringify(claimRes.data)}`);
  }
  console.log('✅ Lost item claimed successfully');

  // ==========================================
  // WEBSOCKET PANIC ALERTS TEST
  // ==========================================
  console.log('\n--- 7. Testing Real-Time Incident / Panic Alerts ---');
  
  // Set up WebSocket client and connect to gateway
  const socketUrl = 'http://localhost:4000/incidents';
  console.log(`Connecting WebSocket to ${socketUrl}...`);
  
  const socket = io(socketUrl, {
    transports: ['websocket'],
    auth: { token }
  });

  const panicPromise = new Promise((resolve, reject) => {
    // Set a timeout to prevent hanging forever
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('WebSocket panic alert broadcast timeout (10 seconds)'));
    }, 10000);

    socket.on('connect', () => {
      console.log('-> WebSocket connected successfully!');
      
      // Trigger Panic API call REST POST route
      console.log('Triggering panic alert via POST /incidents/panic...');
      request(`${API_BASE}/peripherals/incidents/panic`, {
        method: 'POST',
        headers: authHeaders,
        body: { details: 'EMERGENCY: Front Desk Panic Triggered!' }
      }).catch(err => {
        clearTimeout(timer);
        reject(err);
      });
    });

    socket.on('panic_alert', (data) => {
      console.log('Received real-time panic_alert over WebSocket:', JSON.stringify(data, null, 2));
      clearTimeout(timer);
      socket.disconnect();
      resolve(data);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(new Error(`WebSocket connection error: ${err.message}`));
    });
  });

  const receivedAlert = await panicPromise;
  if (!receivedAlert || receivedAlert.type !== 'panic' || !receivedAlert.details.includes('Front Desk')) {
    throw new Error('Panic alert mismatch or incorrect broadcast payload.');
  }
  console.log('✅ Real-time incident panic alert broadcast verified over Socket.io');

  console.log('\n================================================================');
  console.log('   🎉 ALL OPERATIONAL PERIPHERALS OPERATIONS VERIFIED! 🎉');
  console.log('================================================================');
}

testAll().catch(err => {
  console.error('\n❌ VALIDATION TEST FAILED:', err.message);
  process.exit(1);
});
