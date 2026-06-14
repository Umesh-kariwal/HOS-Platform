const http = require('http');
const { PrismaClient } = require('@prisma/client');

// Connect as superuser to verify and clean DB state
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
      if (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH' || options.method === 'DELETE') {
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
  console.log('       HOS MODULE 10 & 11: DISPATCH & REVENUE OPTIMIZATION');
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

  // Clean up any existing service requests, bookings, guests, and revenue rules
  await prisma.serviceRequest.deleteMany();
  await prisma.revenuePricingRule.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.guest.deleteMany();
  console.log('-> Database tables cleared.');

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const BRANCH_ID = '00000000-0000-0000-0000-000000000002';

  // Seed guest
  const guest = await prisma.guest.create({
    data: {
      tenantId: TENANT_ID,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    }
  });

  // Seed booking
  const room = await prisma.room.findFirst({
    where: { branchId: BRANCH_ID }
  });
  if (!room) throw new Error('No rooms found in pilot hotel');

  const booking = await prisma.booking.create({
    data: {
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      guestId: guest.id,
      roomId: room.id,
      checkInDate: new Date('2026-06-11'),
      checkOutDate: new Date('2026-06-15'),
      status: 'checked_in'
    }
  });
  console.log(`Programmatically created checked-in booking ID: ${booking.id}`);

  // Grab receptionist staff employee ID
  const receptionistEmployee = await prisma.employee.findFirst({
    where: { email: 'receptionist@pilot.com' }
  });
  const employeeId = receptionistEmployee.id;
  console.log(`Using employee ID for assignment: ${employeeId}`);

  // ==========================================
  // MODULE 10: GUEST SERVICE REQUEST DISPATCH
  // ==========================================
  console.log('\n--- 2. Create Guest Service Request (Module 10) ---');
  const createReqRes = await request(`${API_BASE}/dispatch`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      bookingId: booking.id,
      requestType: 'towels',
      details: 'Guest requested 3 extra bath towels.'
    }
  });
  console.log('Create Request Status:', createReqRes.status);
  if (createReqRes.status !== 201) {
    throw new Error(`Failed to create service request: ${JSON.stringify(createReqRes.data)}`);
  }
  const requestId = createReqRes.data.id;
  console.log(`-> Created service request ID: ${requestId} (Status: ${createReqRes.data.status})`);

  console.log('\n--- 3. Query All Service Requests ---');
  const getRequestsRes = await request(`${API_BASE}/dispatch`, {
    headers: authHeaders
  });
  console.log('Service requests count:', getRequestsRes.data.length);
  if (getRequestsRes.status !== 200 || getRequestsRes.data.length !== 1) {
    throw new Error(`Expected exactly 1 service request. Got: ${getRequestsRes.data.length}`);
  }
  console.log('✅ PASS: Retrieve service requests verified.');

  console.log('\n--- 4. Assign Service Request to Staff ---');
  const assignReqRes = await request(`${API_BASE}/dispatch/${requestId}/assign`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { assignedEmployeeId: employeeId }
  });
  console.log('Assign request status:', assignReqRes.status);
  if (assignReqRes.status !== 200 || assignReqRes.data.status !== 'assigned' || assignReqRes.data.assignedEmployeeId !== employeeId) {
    throw new Error(`Failed to assign employee: ${JSON.stringify(assignReqRes.data)}`);
  }
  console.log('✅ PASS: Request successfully assigned.');

  console.log('\n--- 5. Complete Service Request ---');
  const completeReqRes = await request(`${API_BASE}/dispatch/${requestId}/complete`, {
    method: 'PATCH',
    headers: authHeaders
  });
  console.log('Complete request status:', completeReqRes.status);
  if (completeReqRes.status !== 200 || completeReqRes.data.status !== 'completed') {
    throw new Error(`Failed to complete request: ${JSON.stringify(completeReqRes.data)}`);
  }
  console.log('✅ PASS: Request successfully marked completed.');


  // ==========================================
  // MODULE 11: DYNAMIC PRICING & REVENUE OPTIMIZATION
  // ==========================================
  console.log('\n--- 6. Test Dynamic Pricing & Revenue Optimization (Module 11) ---');
  
  // Get room type details
  const roomType = await prisma.roomType.findFirst();
  const roomTypeId = roomType.id;
  const baseRate = Number(roomType.rackRate);
  console.log(`Selected Room Type: ${roomType.name} (Code: ${roomType.code}), Rack Rate: $${baseRate}`);

  // Base rate calculation without any rules
  console.log('\n--- 7. Calculate Rate (No Active Rules) ---');
  const baseCalcRes = await request(`${API_BASE}/revenue/calculate-rate?roomTypeId=${roomTypeId}&date=2026-06-20&leadTimeDays=10`, {
    headers: authHeaders
  });
  console.log('Base calculated rate:', baseCalcRes.data.rate);
  if (baseCalcRes.status !== 200 || Number(baseCalcRes.data.rate) !== baseRate) {
    throw new Error(`Expected calculated rate to equal base rate $${baseRate}. Got: ${baseCalcRes.data.rate}`);
  }
  console.log('✅ PASS: Base rate calculation matches rack rate.');

  // Create lead time rule: if lead time <= 3 days, add 15% charge
  console.log('\n--- 8. Create Dynamic Pricing Rule (Lead Time) ---');
  const createRuleRes = await request(`${API_BASE}/revenue/rules`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      roomTypeId,
      ruleType: 'lead_time_lte',
      triggerValue: 3,
      adjustmentPercent: 0.15 // 15% increase
    }
  });
  console.log('Create Rule Status:', createRuleRes.status);
  if (createRuleRes.status !== 201) {
    throw new Error(`Failed to create pricing rule: ${JSON.stringify(createRuleRes.data)}`);
  }
  const ruleId = createRuleRes.data.id;
  console.log(`-> Created pricing rule ID: ${ruleId}`);

  // Query pricing rules
  console.log('\n--- 9. Query Pricing Rules ---');
  const getRulesRes = await request(`${API_BASE}/revenue/rules`, {
    headers: authHeaders
  });
  console.log('Pricing rules count:', getRulesRes.data.length);
  if (getRulesRes.status !== 200 || getRulesRes.data.length !== 1) {
    throw new Error(`Expected exactly 1 pricing rule. Got: ${getRulesRes.data.length}`);
  }
  console.log('✅ PASS: Query pricing rules verified.');

  // Calculate rate under rule: Lead Time = 5 days (should NOT trigger)
  console.log('\n--- 10. Calculate Rate (Rule exists, leadTime = 5, trigger <= 3) ---');
  const calcRuleUntriggeredRes = await request(`${API_BASE}/revenue/calculate-rate?roomTypeId=${roomTypeId}&date=2026-06-20&leadTimeDays=5`, {
    headers: authHeaders
  });
  console.log('Rate (untriggered):', calcRuleUntriggeredRes.data.rate);
  if (Number(calcRuleUntriggeredRes.data.rate) !== baseRate) {
    throw new Error(`Expected rate to be untriggered ($${baseRate}). Got: ${calcRuleUntriggeredRes.data.rate}`);
  }
  console.log('✅ PASS: Rule did not trigger when lead time was outside threshold.');

  // Calculate rate under rule: Lead Time = 2 days (should trigger 15% increase)
  console.log('\n--- 11. Calculate Rate (Rule triggers, leadTime = 2, trigger <= 3) ---');
  const calcRuleTriggeredRes = await request(`${API_BASE}/revenue/calculate-rate?roomTypeId=${roomTypeId}&date=2026-06-20&leadTimeDays=2`, {
    headers: authHeaders
  });
  const expectedTriggeredRate = Number((baseRate * 1.15).toFixed(2));
  console.log('Rate (triggered):', calcRuleTriggeredRes.data.rate, `(Expected: ${expectedTriggeredRate})`);
  if (Number(calcRuleTriggeredRes.data.rate) !== expectedTriggeredRate) {
    throw new Error(`Expected rate to be triggered ($${expectedTriggeredRate}). Got: ${calcRuleTriggeredRes.data.rate}`);
  }
  console.log('✅ PASS: Rule triggered and calculated rate matches 15% increase.');

  // Delete rule
  console.log('\n--- 12. Delete Pricing Rule ---');
  const deleteRuleRes = await request(`${API_BASE}/revenue/rules/${ruleId}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  console.log('Delete Rule Status:', deleteRuleRes.status);
  if (deleteRuleRes.status !== 200) {
    throw new Error(`Failed to delete rule: ${JSON.stringify(deleteRuleRes.data)}`);
  }

  // Verify rate goes back to normal
  const finalCalcRes = await request(`${API_BASE}/revenue/calculate-rate?roomTypeId=${roomTypeId}&date=2026-06-20&leadTimeDays=2`, {
    headers: authHeaders
  });
  console.log('Rate after rule deletion:', finalCalcRes.data.rate);
  if (Number(finalCalcRes.data.rate) !== baseRate) {
    throw new Error(`Expected rate to return to normal ($${baseRate}). Got: ${finalCalcRes.data.rate}`);
  }
  console.log('✅ PASS: Dynamic Pricing rule deletion and rollback verified.');

  console.log('\n================================================================');
  console.log('       MODULE 10 & 11 INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

testAll().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
