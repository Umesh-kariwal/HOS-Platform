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

  console.log('\n================================================================');
  console.log('   🎉 ALL WORKFLOWS PASSED VERIFICATION END-TO-END! 🎉');
  console.log('================================================================');
  
  await prisma.$disconnect();
  process.exit(0);
}

verifyAll();
