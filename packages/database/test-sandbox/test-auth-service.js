const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../../../apps/api/dist/app.module');
const { AuthService } = require('../../../apps/api/dist/auth/auth.service');
const jwt = require('jsonwebtoken');

// Ensure database URL matches the portable instance
process.env.DATABASE_URL = "postgresql://postgres:SecurePassword123@127.0.0.1:5432/hos_catalog?schema=catalog";

async function test() {
  console.log('--- STARTING AUTH SERVICE RUNTIME VALIDATION ---');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const authService = app.get(AuthService);

  // Test 1: Successful Manager Login
  console.log('\n1. Testing successful login for manager@pilot.com...');
  try {
    const res = await authService.login({
      email: 'manager@pilot.com',
      password: 'SecurePassword123'
    });
    console.log('-> Success! Token received:', res.token ? 'YES' : 'NO');
    console.log('-> Employee returned:', res.employee);
    
    // Decode JWT
    const decoded = jwt.decode(res.token);
    console.log('-> Decoded JWT Payload:', decoded);
  } catch (err) {
    console.error('-> Failed! Expected success but got error:', err.message);
  }

  // Test 2: Successful Receptionist Login
  console.log('\n2. Testing successful login for receptionist@pilot.com...');
  try {
    const res = await authService.login({
      email: 'receptionist@pilot.com',
      password: 'SecurePassword123'
    });
    console.log('-> Success! Token received:', res.token ? 'YES' : 'NO');
    console.log('-> Employee returned:', res.employee);
  } catch (err) {
    console.error('-> Failed! Expected success but got error:', err.message);
  }

  // Test 3: Failed Login (Incorrect Password)
  console.log('\n3. Testing failed login with incorrect password...');
  try {
    await authService.login({
      email: 'manager@pilot.com',
      password: 'WrongPassword'
    });
    console.log('-> Failed! Expected rejection but it succeeded!');
  } catch (err) {
    console.log('-> Success! Rejected with expected error:', err.message);
  }

  // Test 4: Failed Login (Non-existent Email)
  console.log('\n4. Testing failed login with non-existent email...');
  try {
    await authService.login({
      email: 'nobody@pilot.com',
      password: 'SecurePassword123'
    });
    console.log('-> Failed! Expected rejection but it succeeded!');
  } catch (err) {
    console.log('-> Success! Rejected with expected error:', err.message);
  }

  await app.close();
  console.log('\n--- AUTH SERVICE VALIDATION COMPLETED ---');
}

test().catch(console.error);
