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
      if (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH') {
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
  console.log('       HOS MODULE 9: MAINTENANCE & PREVENTIVE CARE VALIDATION');
  console.log('================================================================');

  let token = '';
  let authHeaders = {};
  
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

  // Clean up any existing maintenance tickets
  await prisma.maintenanceTicket.deleteMany();

  // 2. QUERY INITIAL TICKETS (Should be empty)
  console.log('\n--- 2. Get Initial Tickets ---');
  const getInitRes = await request(`${API_BASE}/maintenance`, {
    headers: authHeaders
  });
  console.log('Initial tickets count:', getInitRes.data.length);
  if (getInitRes.status !== 200 || getInitRes.data.length !== 0) {
    throw new Error('Expected empty list of tickets.');
  }
  console.log('✅ PASS: Initial tickets count is 0.');

  // 3. CREATE TICKET (General Asset)
  console.log('\n--- 3. Create General Asset Ticket ---');
  const genTicketRes = await request(`${API_BASE}/maintenance`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      description: 'Lobby smart thermostat replacement',
      priority: 'low',
      category: 'electrical'
    }
  });
  console.log('Create response status:', genTicketRes.status);
  if (genTicketRes.status !== 201) {
    throw new Error(`Failed to create ticket: ${JSON.stringify(genTicketRes.data)}`);
  }
  console.log(`-> Created ticket ID: ${genTicketRes.data.id} (Status: ${genTicketRes.data.status})`);

  // 4. CREATE TICKET FOR ROOM 101 (Critical) & VERIFY BLOCK
  console.log('\n--- 4. Create Critical Ticket for Room 101 ---');
  const roomId = '55555555-5555-5555-5555-555555555551'; // Room 101
  const critTicketRes = await request(`${API_BASE}/maintenance`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      roomId,
      description: 'Broken toilet pipe flooding room',
      priority: 'critical',
      category: 'plumbing'
    }
  });
  if (critTicketRes.status !== 201) {
    throw new Error(`Failed to create ticket: ${JSON.stringify(critTicketRes.data)}`);
  }
  const ticketId = critTicketRes.data.id;
  console.log(`-> Created critical ticket ID: ${ticketId}`);

  // Query Room Status in DB directly
  const roomInDb = await prisma.room.findUnique({
    where: { id: roomId }
  });
  console.log('Room physicalStatus in DB:', roomInDb.physicalStatus);
  if (roomInDb.physicalStatus !== 'maintenance') {
    throw new Error('Expected room physicalStatus to be set to "maintenance".');
  }
  console.log('✅ Room marked as "maintenance"');

  // Query Availability Scan
  console.log('\n--- 5. Verify Room Excluded From Availability ---');
  const availRes = await request(`${API_BASE}/inventory/availability?startDate=2026-06-11&endDate=2026-06-13`, {
    headers: authHeaders
  });
  
  const room101Available = availRes.data.availableRooms.some(r => r.id === roomId);
  console.log('Is Room 101 in availableRooms list:', room101Available ? 'YES' : 'NO');
  if (room101Available) {
    throw new Error('Expected Room 101 to be excluded from availability list.');
  }
  console.log('✅ Room 101 successfully blocked from sales.');

  // 5. ASSIGN TICKET TO EMPLOYEE
  console.log('\n--- 6. Assign Ticket to Employee ---');
  const empId = '11111111-1111-1111-1111-111111111112'; // receptionist
  const assignRes = await request(`${API_BASE}/maintenance/${ticketId}/assign`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { assignedEmployeeId: empId }
  });
  console.log('Assign response status:', assignRes.status);
  if (assignRes.status !== 200 || assignRes.data.status !== 'in_progress' || assignRes.data.assignedEmployeeId !== empId) {
    throw new Error(`Failed to assign employee: ${JSON.stringify(assignRes.data)}`);
  }
  console.log('✅ Ticket successfully assigned and status set to in_progress.');

  // 6. COMPLETE TICKET & VERIFY RELEASE
  console.log('\n--- 7. Complete Ticket & Restore Room Status ---');
  const completeRes = await request(`${API_BASE}/maintenance/${ticketId}/complete`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { completionNotes: 'Replaced pipe coupling and tested flow.' }
  });
  console.log('Complete response status:', completeRes.status);
  if (completeRes.status !== 200 || completeRes.data.status !== 'completed') {
    throw new Error(`Failed to complete ticket: ${JSON.stringify(completeRes.data)}`);
  }

  // Query Room Status in DB directly
  const roomInDbAfter = await prisma.room.findUnique({
    where: { id: roomId }
  });
  console.log('Room physicalStatus in DB after completion:', roomInDbAfter.physicalStatus);
  if (roomInDbAfter.physicalStatus !== 'clean') {
    throw new Error('Expected room physicalStatus to be restored to "clean".');
  }
  console.log('✅ Room successfully restored to "clean"');

  // Query Availability Scan
  console.log('\n--- 8. Verify Room Returned To Availability ---');
  const availResAfter = await request(`${API_BASE}/inventory/availability?startDate=2026-06-11&endDate=2026-06-13`, {
    headers: authHeaders
  });
  const room101AvailableAfter = availResAfter.data.availableRooms.some(r => r.id === roomId);
  console.log('Is Room 101 in availableRooms list:', room101AvailableAfter ? 'YES' : 'NO');
  if (!room101AvailableAfter) {
    throw new Error('Expected Room 101 to be restored to availability list.');
  }
  console.log('✅ Room 101 successfully released back into sales inventory.');

  console.log('\n================================================================');
  console.log('   🎉 ALL MAINTENANCE & PREVENTIVE CARE VERIFICATIONS PASSED! 🎉');
  console.log('================================================================');
}

testAll().catch(err => {
  console.error('\n❌ VALIDATION TEST FAILED:', err.message);
  process.exit(1);
});
