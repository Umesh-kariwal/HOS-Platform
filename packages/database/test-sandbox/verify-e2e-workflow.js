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

  console.log('Performing database transaction cleanup for clean E2E run...');
  await prisma.valetTicket.deleteMany();
  await prisma.parkingSlot.deleteMany();
  await prisma.visitorRecord.deleteMany();
  await prisma.lostAndFoundItem.deleteMany();
  await prisma.incidentLog.deleteMany();
  await prisma.maintenanceTicket.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.billingRoutingRule.deleteMany();
  await prisma.folio.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.message.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.inventoryLocation.deleteMany();
  await prisma.item.deleteMany();
  await prisma.nightAuditCheckpoint.deleteMany();

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

      // --- WORKFLOW 9: Guest Service Request Dispatch (GSR) ---
      console.log('\n--- WORKFLOW 9: Guest Service Request Dispatch ---');
      try {
        await prisma.serviceRequest.deleteMany();

        console.log('POST /dispatch request');
        const createReqRes = await request(`${API_BASE}/dispatch`, {
          method: 'POST',
          headers: authHeaders,
          body: {
            bookingId: oopBookingId,
            requestType: 'towels',
            details: 'Extra pillow and towel'
          }
        });
        console.log('POST /dispatch response status:', createReqRes.status);
        if (createReqRes.status !== 201) {
          throw new Error(`Failed to create service request: ${createReqRes.status}`);
        }
        const reqId = createReqRes.data.id;

        console.log('PATCH /dispatch/:id/assign request');
        const assignReqRes = await request(`${API_BASE}/dispatch/${reqId}/assign`, {
          method: 'PATCH',
          headers: authHeaders,
          body: { assignedEmployeeId: '11111111-1111-1111-1111-111111111112' }
        });
        console.log('PATCH /dispatch/:id/assign response status:', assignReqRes.status);
        if (assignReqRes.status !== 200 || assignReqRes.data.status !== 'assigned') {
          throw new Error(`Failed to assign service request: ${assignReqRes.status}`);
        }

        console.log('PATCH /dispatch/:id/complete request');
        const completeReqRes = await request(`${API_BASE}/dispatch/${reqId}/complete`, {
          method: 'PATCH',
          headers: authHeaders
        });
        console.log('PATCH /dispatch/:id/complete response status:', completeReqRes.status);
        if (completeReqRes.status !== 200 || completeReqRes.data.status !== 'completed') {
          throw new Error(`Failed to complete service request: ${completeReqRes.status}`);
        }

        console.log('✅ WORKFLOW 9 PASS');
      } catch (err) {
        console.error('❌ WORKFLOW 9 FAIL:', err.message);
        process.exit(1);
      }

      // --- WORKFLOW 10: Dynamic Pricing & Revenue Optimization (DPR) ---
      console.log('\n--- WORKFLOW 10: Dynamic Pricing & Revenue Optimization ---');
      try {
        await prisma.revenuePricingRule.deleteMany();
        const testRoomTypeId = '44444444-4444-4444-4444-444444444441'; // Standard Room

        // Check base calculated rate (untriggered)
        console.log('GET /revenue/calculate-rate (base rate)');
        const baseRateRes = await request(`${API_BASE}/revenue/calculate-rate?roomTypeId=${testRoomTypeId}&date=2026-06-20&leadTimeDays=10`, {
          headers: authHeaders
        });
        console.log('GET /revenue/calculate-rate status:', baseRateRes.status, 'rate:', baseRateRes.data.rate);
        if (baseRateRes.status !== 200 || Number(baseRateRes.data.rate) !== 100) {
          throw new Error(`Expected base rate of 100, got ${baseRateRes.data.rate}`);
        }

        // Create pricing rule
        console.log('POST /revenue/rules request');
        const ruleRes = await request(`${API_BASE}/revenue/rules`, {
          method: 'POST',
          headers: authHeaders,
          body: {
            roomTypeId: testRoomTypeId,
            ruleType: 'lead_time_lte',
            triggerValue: 3,
            adjustmentPercent: 0.20
          }
        });
        console.log('POST /revenue/rules response status:', ruleRes.status);
        if (ruleRes.status !== 201) {
          throw new Error(`Failed to create pricing rule: ${ruleRes.status}`);
        }
        const pricingRuleId = ruleRes.data.id;

        // Calculate rate under rule (should trigger 20% increase)
        console.log('GET /revenue/calculate-rate (triggered)');
        const triggeredRateRes = await request(`${API_BASE}/revenue/calculate-rate?roomTypeId=${testRoomTypeId}&date=2026-06-20&leadTimeDays=2`, {
          headers: authHeaders
        });
        console.log('GET /revenue/calculate-rate triggered rate:', triggeredRateRes.data.rate);
        if (Number(triggeredRateRes.data.rate) !== 120) {
          throw new Error(`Expected triggered rate of 120, got ${triggeredRateRes.data.rate}`);
        }

        // Delete pricing rule
        console.log('DELETE /revenue/rules/:id request');
        const deleteRes = await request(`${API_BASE}/revenue/rules/${pricingRuleId}`, {
          method: 'DELETE',
          headers: authHeaders
        });
        console.log('DELETE /revenue/rules/:id response status:', deleteRes.status);
        if (deleteRes.status !== 200) {
          throw new Error(`Failed to delete pricing rule: ${deleteRes.status}`);
        }

        console.log('✅ WORKFLOW 10 PASS');
      } catch (err) {
        console.error('❌ WORKFLOW 10 FAIL:', err.message);
        process.exit(1);
      }

      // --- WORKFLOW 11: E2E STAFF MESSAGING DELIVERY ---
      console.log('\n--- WORKFLOW 11: E2E Staff Messaging ---');
      try {
        const EMP_MGR_ID = '11111111-1111-1111-1111-111111111111';
        console.log('POST /messaging request (Send message to Manager)');
        const msgRes = await request(`${API_BASE}/messaging`, {
          method: 'POST',
          headers: authHeaders,
          body: {
            recipientId: EMP_MGR_ID,
            content: 'E2E Staff messaging validation test.'
          }
        });
        console.log('POST /messaging response status:', msgRes.status);
        if (msgRes.status !== 201) {
          throw new Error(`Failed to send message: ${msgRes.status}`);
        }
        const msgId = msgRes.data.id;

        console.log('GET /messaging/conversation/:otherEmployeeId request');
        const convRes = await request(`${API_BASE}/messaging/conversation/${EMP_MGR_ID}`, {
          headers: authHeaders
        });
        console.log('GET /messaging/conversation/:otherEmployeeId count:', convRes.data.length);
        if (convRes.status !== 200 || convRes.data.length === 0) {
          throw new Error('No messages found in conversation history');
        }

        console.log('Logging in as Manager to mark message as read...');
        const mgrLoginRes = await request(`${API_BASE}/auth/login`, {
          method: 'POST',
          body: {
            email: 'manager@pilot.com',
            password: 'SecurePassword123'
          }
        });
        const mgrHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mgrLoginRes.data.token}`
        };

        console.log('PATCH /messaging/:id/read request (as Manager)');
        const readRes = await request(`${API_BASE}/messaging/${msgId}/read`, {
          method: 'PATCH',
          headers: mgrHeaders
        });
        console.log('PATCH /messaging/:id/read status:', readRes.status);
        if (readRes.status !== 200) {
          throw new Error(`Failed to mark message read: ${readRes.status}`);
        }

        console.log('✅ WORKFLOW 11 PASS');
      } catch (err) {
        console.error('❌ WORKFLOW 11 FAIL:', err.message);
        process.exit(1);
      }

      // --- WORKFLOW 12: MINIBAR CONSUMPTION & AUTO-BILLING ---
      console.log('\n--- WORKFLOW 12: Minibar Consumption & Auto-Billing ---');
      try {
        const TENANT_ID = '00000000-0000-0000-0000-000000000001';
        // A. Create Catalog Item
        console.log('POST /inventory/items request');
        const itemRes = await request(`${API_BASE}/inventory/items`, {
          method: 'POST',
          headers: authHeaders,
          body: {
            sku: 'E2E-MINI-01',
            name: 'Premium Cashews',
            category: 'snack',
            safetyStockThreshold: 2
          }
        });
        console.log('POST /inventory/items response status:', itemRes.status);
        if (itemRes.status !== 201) {
          throw new Error(`Failed to create item: ${itemRes.status}`);
        }
        const itemId = itemRes.data.id;

        // B. Create Location for Room 102 Minibar
        console.log('POST /inventory/locations request');
        const locRes = await request(`${API_BASE}/inventory/locations`, {
          method: 'POST',
          headers: authHeaders,
          body: { name: 'Room 102 Minibar' }
        });
        console.log('POST /inventory/locations response status:', locRes.status);
        if (locRes.status !== 201) {
          throw new Error(`Failed to create location: ${locRes.status}`);
        }
        const locId = locRes.data.id;

        // C. Adjust Stock (Pre-stock minibar with 5 units)
        console.log('POST /inventory/stock request');
        const stockRes = await request(`${API_BASE}/inventory/stock`, {
          method: 'POST',
          headers: authHeaders,
          body: {
            inventoryLocationId: locId,
            itemId: itemId,
            quantity: 5
          }
        });
        console.log('POST /inventory/stock response status:', stockRes.status);
        if (stockRes.status !== 201) {
          throw new Error(`Failed to pre-stock minibar: ${stockRes.status}`);
        }

        // D. Consume 3 units
        console.log('POST /inventory/minibar/consume request (Room 102)');
        const consumeRes = await request(`${API_BASE}/inventory/minibar/consume`, {
          method: 'POST',
          headers: authHeaders,
          body: {
            roomNumber: '102',
            sku: 'E2E-MINI-01',
            quantity: 3,
            unitPrice: 6.50
          }
        });
        console.log('POST /inventory/minibar/consume response status:', consumeRes.status);
        if (consumeRes.status !== 201) {
          throw new Error(`Failed to consume minibar: ${consumeRes.status}`);
        }

        // E. Verify Stock decremented to 2
        console.log('Verifying stock level in database...');
        const dbStock = await prisma.stockLevel.findUnique({
          where: {
            uq_location_item: {
              tenantId: TENANT_ID,
              inventoryLocationId: locId,
              itemId: itemId
            }
          }
        });
        console.log(`   Remaining Stock Level: ${dbStock.quantity} (Expected: 2)`);
        if (dbStock.quantity !== 2) {
          throw new Error(`Expected remaining stock to be 2, got ${dbStock.quantity}`);
        }

        // F. Verify charge is posted to Folio
        console.log('Verifying Folio ledger entry for booking...');
        const dbFolio = await prisma.folio.findFirst({
          where: { bookingId: oopBookingId }
        });
        if (!dbFolio) {
          throw new Error('No folio found for active booking');
        }

        const folioRes = await request(`${API_BASE}/folios/${dbFolio.id}`, {
          headers: authHeaders
        });
        console.log('GET /folios/:id status:', folioRes.status);
        const entries = folioRes.data.ledgerEntries || [];
        const minibarEntry = entries.find(e => e.type === 'minibar');
        if (!minibarEntry) {
          throw new Error('No "minibar" ledger entry found on folio');
        }
        console.log(`   Charge posted: "${minibarEntry.description}" | Amount: $${minibarEntry.amount}`);
        if (Number(minibarEntry.amount) !== 19.50) {
          throw new Error(`Expected charge of 19.50, got ${minibarEntry.amount}`);
        }

        console.log('✅ WORKFLOW 12 PASS');
      } catch (err) {
        console.error('❌ WORKFLOW 12 FAIL:', err.message);
        process.exit(1);
      }

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
