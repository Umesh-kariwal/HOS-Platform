const http = require('http');
const { PrismaClient } = require('@prisma/client');

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

function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
  } catch (e) {
    return null;
  }
}

async function verifyAll() {
  console.log('================================================================');
  console.log('         HOS END-TO-END VERIFICATION & READINESS GATE');
  console.log('================================================================');

  let token = '';
  let authHeaders = {};
  let bookingId = '';
  let roomId = '55555555-5555-5555-5555-555555555551'; // Room 101

  // ----------------------------------------------------------------
  // WORKFLOW 1: RECEPTIONIST LOGIN
  // ----------------------------------------------------------------
  console.log('\n--- WORKFLOW 1: Receptionist Login ---');
  try {
    const loginPayload = {
      email: 'receptionist@pilot.com',
      password: 'SecurePassword123'
    };
    console.log('POST /auth/login request payload:', loginPayload);
    const loginRes = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: loginPayload
    });

    console.log('POST /auth/login response status:', loginRes.status);
    console.log('POST /auth/login response body:', JSON.stringify(loginRes.data, null, 2));

    if (loginRes.status !== 201 && loginRes.status !== 200) {
      throw new Error(`Login failed with status ${loginRes.status}`);
    }

    token = loginRes.data.token;
    authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const decoded = decodeJwt(token);
    console.log('Decoded JWT payload verification:');
    console.log(`- employeeId: ${decoded.employeeId} (Match: ${decoded.employeeId ? 'YES' : 'NO'})`);
    console.log(`- tenantId:   ${decoded.tenantId} (Match: ${decoded.tenantId ? 'YES' : 'NO'})`);
    console.log(`- role:       ${decoded.role} (Match: ${decoded.role ? 'YES' : 'NO'})`);
    console.log(`- branchId:   ${decoded.branchId} (Match: ${decoded.branchId ? 'YES' : 'NO'})`);

    console.log('✅ WORKFLOW 1 PASS');
  } catch (err) {
    console.error('❌ WORKFLOW 1 FAIL:', err.message);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // WORKFLOW 2: RESERVATION LIFECYCLE
  // ----------------------------------------------------------------
  console.log('\n--- WORKFLOW 2: Reservation Lifecycle ---');
  try {
    const bookingPayload = {
      guestFirstName: 'John',
      guestLastName: 'Doe',
      guestEmail: 'john.doe@gmail.com',
      checkInDate: '2026-06-11',
      checkOutDate: '2026-06-13',
      roomId: roomId
    };
    console.log('POST /bookings request payload:', bookingPayload);
    const bookingRes = await request(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: authHeaders,
      body: bookingPayload
    });

    console.log('POST /bookings response status:', bookingRes.status);
    console.log('POST /bookings response body:', JSON.stringify(bookingRes.data, null, 2));

    if (bookingRes.status !== 201 && bookingRes.status !== 200) {
      throw new Error(`Booking creation failed with status ${bookingRes.status}`);
    }

    bookingId = bookingRes.data.id;

    // Database verification
    console.log('Querying database to check booking record existence...');
    const dbBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { guest: true }
    });
    console.log('Database Query Result:');
    console.log(`- Booking ID:     ${dbBooking.id}`);
    console.log(`- Guest Email:    ${dbBooking.guest.email}`);
    console.log(`- Room ID:        ${dbBooking.roomId}`);
    console.log(`- Booking Status: ${dbBooking.status}`);

    console.log('✅ WORKFLOW 2 PASS');
  } catch (err) {
    console.error('❌ WORKFLOW 2 FAIL:', err.message);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // WORKFLOW 3: GUEST CHECK-IN
  // ----------------------------------------------------------------
  console.log('\n--- WORKFLOW 3: Guest Check-In ---');
  try {
    const checkInPayload = { roomId: roomId };
    console.log(`POST /bookings/${bookingId}/check-in request payload:`, checkInPayload);
    const checkInRes = await request(`${API_BASE}/bookings/${bookingId}/check-in`, {
      method: 'POST',
      headers: authHeaders,
      body: checkInPayload
    });

    console.log('POST /bookings/:id/check-in response status:', checkInRes.status);
    console.log('POST /bookings/:id/check-in response body:', JSON.stringify(checkInRes.data, null, 2));

    if (checkInRes.status !== 201 && checkInRes.status !== 200) {
      throw new Error(`Check-in failed with status ${checkInRes.status}`);
    }

    // Database verification
    console.log('Querying database to check RLS update...');
    const dbBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    const dbRoom = await prisma.room.findUnique({ where: { id: roomId } });
    console.log('Database Query Result:');
    console.log(`- Booking Status:    ${dbBooking.status} (Expected: checked_in)`);
    console.log(`- Room Occupancy:    ${dbRoom.occupancyStatus} (Expected: occupied)`);

    if (dbBooking.status !== 'checked_in' || dbRoom.occupancyStatus !== 'occupied') {
      throw new Error('State mismatch in database verification.');
    }

    console.log('✅ WORKFLOW 3 PASS');
  } catch (err) {
    console.error('❌ WORKFLOW 3 FAIL:', err.message);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // WORKFLOW 4: GUEST CHECK-OUT
  // ----------------------------------------------------------------
  console.log('\n--- WORKFLOW 4: Guest Check-Out ---');
  try {
    console.log(`POST /bookings/${bookingId}/check-out request`);
    const checkOutRes = await request(`${API_BASE}/bookings/${bookingId}/check-out`, {
      method: 'POST',
      headers: authHeaders
    });

    console.log('POST /bookings/:id/check-out response status:', checkOutRes.status);
    console.log('POST /bookings/:id/check-out response body:', JSON.stringify(checkOutRes.data, null, 2));

    if (checkOutRes.status !== 201 && checkOutRes.status !== 200) {
      throw new Error(`Check-out failed with status ${checkOutRes.status}`);
    }

    // Database verification
    console.log('Querying database to check checkout updates...');
    const dbBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    const dbRoom = await prisma.room.findUnique({ where: { id: roomId } });
    console.log('Database Query Result:');
    console.log(`- Booking Status:    ${dbBooking.status} (Expected: checked_out)`);
    console.log(`- Room Occupancy:    ${dbRoom.occupancyStatus} (Expected: vacant)`);
    console.log(`- Room Cleanliness:  ${dbRoom.physicalStatus} (Expected: dirty)`);

    if (dbBooking.status !== 'checked_out' || dbRoom.occupancyStatus !== 'vacant' || dbRoom.physicalStatus !== 'dirty') {
      throw new Error('State mismatch in database verification.');
    }

    console.log('✅ WORKFLOW 4 PASS');
  } catch (err) {
    console.error('❌ WORKFLOW 4 FAIL:', err.message);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // WORKFLOW 5: HOUSEKEEPING CLEANING
  // ----------------------------------------------------------------
  console.log('\n--- WORKFLOW 5: Housekeeping Cleaning ---');
  try {
    const housekeepingPayload = { physicalStatus: 'clean' };
    console.log(`POST /rooms/${roomId}/status request payload:`, housekeepingPayload);
    const hkRes = await request(`${API_BASE}/rooms/${roomId}/status`, {
      method: 'POST',
      headers: authHeaders,
      body: housekeepingPayload
    });

    console.log('POST /rooms/:id/status response status:', hkRes.status);
    console.log('POST /rooms/:id/status response body:', JSON.stringify(hkRes.data, null, 2));

    if (hkRes.status !== 201 && hkRes.status !== 200) {
      throw new Error(`Housekeeping update failed with status ${hkRes.status}`);
    }

    // Database verification
    console.log('Querying database to check cleanliness status...');
    const dbRoom = await prisma.room.findUnique({ where: { id: roomId } });
    console.log('Database Query Result:');
    console.log(`- Room Cleanliness:  ${dbRoom.physicalStatus} (Expected: clean)`);

    if (dbRoom.physicalStatus !== 'clean') {
      throw new Error('State mismatch in database verification.');
    }

    console.log('✅ WORKFLOW 5 PASS');
  } catch (err) {
    console.error('❌ WORKFLOW 5 FAIL:', err.message);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // WORKFLOW 6: NIGHT AUDIT ROLLOVER
  // ----------------------------------------------------------------
  console.log('\n--- WORKFLOW 6: Night Audit Rollover ---');
  try {
    console.log('GET /night-audit/status request');
    const statusRes = await request(`${API_BASE}/night-audit/status`, {
      headers: authHeaders
    });
    console.log('GET /night-audit/status response body:', JSON.stringify(statusRes.data, null, 2));

    const initialDate = statusRes.data.businessDate;

    console.log('POST /night-audit/roll-date request');
    const rollRes = await request(`${API_BASE}/night-audit/roll-date`, {
      method: 'POST',
      headers: authHeaders
    });
    console.log('POST /night-audit/roll-date response status:', rollRes.status);
    console.log('POST /night-audit/roll-date response body:', JSON.stringify(rollRes.data, null, 2));

    if (rollRes.status !== 201 && rollRes.status !== 200) {
      throw new Error(`Date rollover failed with status ${rollRes.status}`);
    }

    // Database verification
    console.log('Querying database to check property dates and checkpoints...');
    const dbPropDate = await prisma.propertyDate.findFirst({
      where: { branchId: '00000000-0000-0000-0000-000000000002' }
    });
    const dbCheckpointsCount = await prisma.nightAuditCheckpoint.count({
      where: { branchId: '00000000-0000-0000-0000-000000000002' }
    });

    console.log('Database Query Result:');
    console.log(`- New Business Date:  ${dbPropDate.businessDate.toISOString().split('T')[0]} (Expected: 2026-06-12)`);
    console.log(`- Checkpoints Count:  ${dbCheckpointsCount} (Expected: >0)`);

    console.log('✅ WORKFLOW 6 PASS');
  } catch (err) {
    console.error('❌ WORKFLOW 6 FAIL:', err.message);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // WORKFLOW 7: OPERATIONAL PERIPHERALS (OOP) INTEGRATION
  // ----------------------------------------------------------------
  // ----------------------------------------------------------------
  // WORKFLOW 7: OPERATIONAL PERIPHERALS (OOP) INTEGRATION
  // ----------------------------------------------------------------
  console.log('\n--- WORKFLOW 7: Operational Peripherals (OOP) Integration ---');
  try {
    // 0. Setup a fresh checked-in booking for peripherals testing
    console.log('POST /bookings request (fresh booking for peripherals)');
    const oopBookingRes = await request(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        guestFirstName: 'Bob',
        guestLastName: 'Visitor',
        guestEmail: 'bob.visitor@gmail.com',
        checkInDate: '2026-06-11',
        checkOutDate: '2026-06-13',
        roomId: '55555555-5555-5555-5555-555555555552' // Room 102 to avoid conflict on Room 101
      }
    });
    if (oopBookingRes.status !== 201) {
      throw new Error(`OOP booking creation failed: ${oopBookingRes.status}`);
    }
    const oopBookingId = oopBookingRes.data.id;
    console.log(`-> Fresh Booking Created: ${oopBookingId}`);

    console.log('POST /bookings/:id/check-in request');
    const oopCheckinRes = await request(`${API_BASE}/bookings/${oopBookingId}/check-in`, {
      method: 'POST',
      headers: authHeaders,
      body: { roomId: '55555555-5555-5555-5555-555555555552' }
    });
    if (oopCheckinRes.status !== 201) {
      throw new Error(`OOP check-in failed: ${oopCheckinRes.status}`);
    }
    console.log('-> Fresh Booking checked in.');

    // A. Create Parking Slot
    console.log('POST /peripherals/parking request');
    const slotRes = await request(`${API_BASE}/peripherals/parking`, {
      method: 'POST',
      headers: authHeaders,
      body: { slotIdentifier: 'E2E Slot 1' }
    });
    console.log('POST /peripherals/parking response status:', slotRes.status);
    if (slotRes.status !== 201) {
      throw new Error(`Failed to create slot: ${slotRes.status}`);
    }
    const slotId = slotRes.data.id;

    // B. Issue Valet Ticket
    console.log('POST /peripherals/valet request');
    const valetRes = await request(`${API_BASE}/peripherals/valet`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        bookingId: oopBookingId,
        vehicleLicense: 'E2E-LICENSE',
        keyTag: 'K-E2E',
        parkingSlotId: slotId
      }
    });
    console.log('POST /peripherals/valet response status:', valetRes.status);
    if (valetRes.status !== 201) {
      throw new Error(`Failed to create valet ticket: ${valetRes.status}`);
    }
    const valetTicketId = valetRes.data.id;

    // Verify slot is occupied in DB
    const slotDb = await prisma.parkingSlot.findUnique({ where: { id: slotId } });
    console.log('Database Query Result: Slot Status:', slotDb.status);
    if (slotDb.status !== 'occupied') {
      throw new Error('Expected slot status to be occupied.');
    }

    // Retrieve vehicle
    console.log('PATCH /peripherals/valet/:id/retrieve request');
    const retrieveRes = await request(`${API_BASE}/peripherals/valet/${valetTicketId}/retrieve`, {
      method: 'PATCH',
      headers: authHeaders
    });
    console.log('PATCH /peripherals/valet/:id/retrieve response status:', retrieveRes.status);
    if (retrieveRes.status !== 200) {
      throw new Error(`Failed to retrieve vehicle: ${retrieveRes.status}`);
    }

    // Verify slot is vacant in DB
    const slotDbAfter = await prisma.parkingSlot.findUnique({ where: { id: slotId } });
    console.log('Database Query Result: Slot Status after retrieval:', slotDbAfter.status);
    if (slotDbAfter.status !== 'vacant') {
      throw new Error('Expected slot status to return to vacant.');
    }

    // C. Visitor Check-in (with Server-side Hashing)
    console.log('POST /peripherals/visitors request');
    const visitorRes = await request(`${API_BASE}/peripherals/visitors`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        bookingId: oopBookingId,
        firstName: 'John',
        lastName: 'Visitor',
        idNumber: 'PASSPORT-998877'
      }
    });
    console.log('POST /peripherals/visitors response status:', visitorRes.status);
    if (visitorRes.status !== 201) {
      throw new Error(`Failed to register visitor: ${visitorRes.status}`);
    }
    const visitorRecordId = visitorRes.data.id;

    // Verify DB hashing
    const visitorDb = await prisma.visitorRecord.findUnique({ where: { id: visitorRecordId } });
    console.log(`Database Query Result: Visitor record ID Hash: ${visitorDb.idHash}`);
    if (!visitorDb.idHash || visitorDb.idHash.length !== 64 || JSON.stringify(visitorDb).includes('PASSPORT-998877')) {
      throw new Error('PII Leak or hashing failure: Plain text ID document is stored!');
    }

    // Checkout visitor
    console.log('PATCH /peripherals/visitors/:id/checkout request');
    const checkoutRes = await request(`${API_BASE}/peripherals/visitors/${visitorRecordId}/checkout`, {
      method: 'PATCH',
      headers: authHeaders
    });
    console.log('PATCH /peripherals/visitors/:id/checkout response status:', checkoutRes.status);
    if (checkoutRes.status !== 200) {
      throw new Error(`Failed to checkout visitor: ${checkoutRes.status}`);
    }

    // D. Lost & Found
    console.log('POST /peripherals/lost-found request');
    const lostRes = await request(`${API_BASE}/peripherals/lost-found`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        roomId: '55555555-5555-5555-5555-555555555551',
        description: 'iPhone 15 Pro',
        storageBin: 'Bin L-9'
      }
    });
    console.log('POST /peripherals/lost-found response status:', lostRes.status);
    if (lostRes.status !== 201) {
      throw new Error(`Failed to log lost item: ${lostRes.status}`);
    }
    const lostItemId = lostRes.data.id;

    // Claim item
    console.log('PATCH /peripherals/lost-found/:id/claim request');
    const claimRes = await request(`${API_BASE}/peripherals/lost-found/${lostItemId}/claim`, {
      method: 'PATCH',
      headers: authHeaders,
      body: { claimantName: 'John Visitor' }
    });
    console.log('PATCH /peripherals/lost-found/:id/claim response status:', claimRes.status);
    if (claimRes.status !== 200) {
      throw new Error(`Failed to claim lost item: ${claimRes.status}`);
    }

    // E. Incident Log
    console.log('POST /peripherals/incidents request');
    const incidentRes = await request(`${API_BASE}/peripherals/incidents`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        type: 'general',
        details: 'Reception desk keyboard spill'
      }
    });
    console.log('POST /peripherals/incidents response status:', incidentRes.status);
    if (incidentRes.status !== 201) {
      throw new Error(`Failed to log incident: ${incidentRes.status}`);
    }

    console.log('✅ WORKFLOW 7 PASS');

    // --- WORKFLOW 8: Maintenance & Preventive Care (Ticketing) ---
    console.log('\n--- WORKFLOW 8: Maintenance & Preventive Care ---');
    try {
      // Clean up previous maintenance tickets
      await prisma.maintenanceTicket.deleteMany();

      console.log('POST /maintenance request (Create ticket for Room 102)');
      const maintRes = await request(`${API_BASE}/maintenance`, {
        method: 'POST',
        headers: authHeaders,
        body: {
          roomId: '55555555-5555-5555-5555-555555555552', // Room 102
          description: 'AC compressor overheating',
          priority: 'critical',
          category: 'hvac'
        }
      });
      console.log('POST /maintenance response status:', maintRes.status);
      if (maintRes.status !== 201) {
        throw new Error(`Failed to create maintenance ticket: ${maintRes.status}`);
      }
      const ticketId = maintRes.data.id;

      // Verify Room is set to maintenance physicalStatus in DB
      const maintRoom = await prisma.room.findUnique({ where: { id: '55555555-5555-5555-5555-555555555552' } });
      console.log('Database Query Result: Room 102 status:', maintRoom.physicalStatus);
      if (maintRoom.physicalStatus !== 'maintenance') {
        throw new Error('Expected Room 102 to be in maintenance status.');
      }

      // Complete ticket
      console.log('PATCH /maintenance/:id/complete request');
      const completeMaintRes = await request(`${API_BASE}/maintenance/${ticketId}/complete`, {
        method: 'PATCH',
        headers: authHeaders,
        body: { completionNotes: 'Cleaned compressor coils and fan blades.' }
      });
      console.log('PATCH /maintenance/:id/complete response status:', completeMaintRes.status);
      if (completeMaintRes.status !== 200) {
        throw new Error(`Failed to complete ticket: ${completeMaintRes.status}`);
      }

      // Verify Room is restored to clean physicalStatus in DB
      const restoredRoom = await prisma.room.findUnique({ where: { id: '55555555-5555-5555-5555-555555555552' } });
      console.log('Database Query Result: Room 102 status after completion:', restoredRoom.physicalStatus);
      if (restoredRoom.physicalStatus !== 'clean') {
        throw new Error('Expected Room 102 to return to clean status.');
      }

      console.log('✅ WORKFLOW 8 PASS');
    } catch (err) {
      console.error('❌ WORKFLOW 8 FAIL:', err.message);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ WORKFLOW 7 FAIL:', err.message);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('   🎉 ALL WORKFLOWS PASSED VERIFICATION END-TO-END! 🎉');
  console.log('================================================================');
  
  await prisma.$disconnect();
  process.exit(0);
}

verifyAll();
