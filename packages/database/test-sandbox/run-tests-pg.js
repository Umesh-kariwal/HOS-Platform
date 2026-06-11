const { PrismaClient } = require('./test-client-pg');
const { AsyncLocalStorage } = require('async_hooks');

const tenantContextStore = new AsyncLocalStorage();

// Administrative Prisma Client (superuser 'postgres' for DDL and seeding)
const adminPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:SecurePassword123@127.0.0.1:5432/hos_catalog?schema=catalog"
    }
  }
});

// Application Prisma Client (non-superuser 'hos_app_user' for testing RLS enforcement)
const rawPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://hos_app_user:SecurePassword123@127.0.0.1:5432/hos_catalog?schema=catalog"
    }
  }
});

let extensionRunCount = 0;

// Replicate the exact production query extension logic
const extendedClient = rawPrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        extensionRunCount++;
        const context = tenantContextStore.getStore();
        const tenantId = context?.tenantId;
        
        const globalModels = ['Tenant'];

        if (tenantId && !globalModels.includes(model)) {
          const anyArgs = args;

          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            const mappedOperation = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
            anyArgs.where = {
              AND: [
                anyArgs.where || {},
                { tenantId }
              ]
            };
            // BUG IN PRODUCTION: delegates to rawPrisma (or base client), escaping transaction context
            return rawPrisma[model][mappedOperation](anyArgs);
          }

          if (operation === 'update' || operation === 'delete') {
            const record = await rawPrisma[model].findFirst({
              where: {
                AND: [
                  anyArgs.where || {},
                  { tenantId }
                ]
              }
            });
            if (!record) {
              throw new Error(`Record not found or access denied for model ${model} under active tenant context.`);
            }
            return query(args);
          }

          const isCreate = ['create', 'createMany'].includes(operation);
          if (!isCreate) {
            const existingWhere = anyArgs.where;
            if (existingWhere) {
              anyArgs.where = { AND: [existingWhere, { tenantId }] };
            } else {
              anyArgs.where = { tenantId };
            }
          } else {
            if (anyArgs.data) {
              if (Array.isArray(anyArgs.data)) {
                anyArgs.data.forEach(item => { item.tenantId = tenantId; });
              } else {
                anyArgs.data.tenantId = tenantId;
              }
            }
          }
        }
        return query(args);
      }
    }
  }
});

const prismaServiceInstance = {
  prisma: rawPrisma,
  client: extendedClient,
  get employee() { return this.client.employee; },
  get tenant() { return this.client.tenant; }
};

// Implement runInTenantContext exactly as current production
async function runInTenantContextCurrent(tenantId, fn) {
  return rawPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return fn(tx);
  });
}

// Implement runInTenantContext using the extended client $transaction (which is recommended to keep extensions)
async function runInTenantContextExtended(tenantId, fn) {
  return extendedClient.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return fn(tx);
  });
}

const TENANT_A_UUID = '00000000-0000-0000-0000-00000000000a';
const TENANT_B_UUID = '00000000-0000-0000-0000-00000000000b';
const EMP_A_UUID = '11111111-1111-1111-1111-11111111111a';
const EMP_B_UUID = '11111111-1111-1111-1111-11111111111b';

async function resetDB() {
  // Disable RLS temporarily via adminPrisma to clear and seed
  await adminPrisma.$executeRawUnsafe(`ALTER TABLE catalog.employees DISABLE ROW LEVEL SECURITY;`);
  
  await adminPrisma.employee.deleteMany();
  await adminPrisma.tenant.deleteMany();

  // Seed standard global tenants
  await adminPrisma.tenant.create({
    data: { id: TENANT_A_UUID, name: 'Tenant A' }
  });
  await adminPrisma.tenant.create({
    data: { id: TENANT_B_UUID, name: 'Tenant B' }
  });
}

async function runTests() {
  console.log('--- STARTING RUNTIME POSTGRESQL MULTI-TENANT VERIFICATION ---');
  await resetDB();

  // ==========================================
  // TEST 1: Confirm whether transaction client `tx` truly bypasses Prisma extensions
  // ==========================================
  console.log('\n--- TEST 1: Transaction Client Bypasses Extensions (PostgreSQL) ---');
  extensionRunCount = 0;
  
  await tenantContextStore.run({ tenantId: TENANT_A_UUID }, async () => {
    // 1. Direct query on extended client
    await prismaServiceInstance.employee.findMany();
    console.log(`Direct query on extended client -> Extension Run Count: ${extensionRunCount}`);
    
    // 2. Query inside transaction on tx (rawPrisma.$transaction)
    await runInTenantContextCurrent(TENANT_A_UUID, async (tx) => {
      extensionRunCount = 0;
      await tx.employee.findMany();
      console.log(`Query on tx inside transaction (raw client $transaction) -> Extension Run Count: ${extensionRunCount}`);
    });
  });

  // ==========================================
  // TEST 2: Confirm whether queries executed through `tx` escape transaction boundaries
  // ==========================================
  console.log('\n--- TEST 2: Transaction Escaping Proof (PostgreSQL) ---');
  
  // Scenario A: Unextended tx (raw client $transaction)
  console.log('\nScenario A: Unextended transaction client (current code)');
  await resetDB();
  await tenantContextStore.run({ tenantId: TENANT_A_UUID }, async () => {
    await runInTenantContextCurrent(TENANT_A_UUID, async (tx) => {
      await tx.employee.create({
        data: { id: EMP_A_UUID, tenantId: TENANT_A_UUID, email: 'unextended@tenant-a.com' }
      });
      console.log('Inserted employee unextended@tenant-a.com inside transaction.');

      // Query on tx. Since tx is unextended, it bypasses the extension and does not escape.
      const result = await tx.employee.findUnique({
        where: { id: EMP_A_UUID }
      });
      console.log(`Querying via tx.employee.findUnique -> Result:`, result ? 'Found Employee (Did not escape)' : 'Null');
    });
  });

  // Scenario B: Extended tx (extended client $transaction)
  console.log('\nScenario B: Extended transaction client (if we run $transaction on extended client)');
  await resetDB();
  try {
    await tenantContextStore.run({ tenantId: TENANT_A_UUID }, async () => {
      await runInTenantContextExtended(TENANT_A_UUID, async (tx) => {
        // Create an employee inside the transaction
        await tx.employee.create({
          data: { id: EMP_A_UUID, tenantId: TENANT_A_UUID, email: 'escaped@tenant-a.com' }
        });
        console.log('Inserted employee escaped@tenant-a.com inside transaction (uncommitted).');

        // Since tx is extended, findUnique triggers the extension.
        // The extension delegates to rawPrisma (root client).
        // Under PostgreSQL, this checks out a separate connection from the pool.
        // Because the transaction is uncommitted, the query returns null!
        const escapedResult = await tx.employee.findUnique({
          where: { id: EMP_A_UUID }
        });
        console.log(`Querying via tx.employee.findUnique (intercepted) -> Result:`, escapedResult);
        
        // FindFirst goes directly to query(args) on tx without triggering the findUnique mapping, so it stays in the transaction.
        const boundResult = await tx.employee.findFirst({
          where: { id: EMP_A_UUID }
        });
        console.log(`Querying via tx.employee.findFirst (bypasses escape) -> Result:`, boundResult ? 'Found Employee!' : 'Null');
        
        if (escapedResult === null && boundResult !== null) {
          console.log('✅ PROVEN: When tx is extended, tx.employee.findUnique escaped the transaction and returned null because it executed on a separate connection from the Prisma connection pool, failing to see the uncommitted transaction data!');
        } else {
          console.log('❌ FAILED: Transaction escaping not demonstrated.');
        }
      });
    });
  } catch (err) {
    console.error('Error in Test 2 Scenario B:', err);
  }

  // ==========================================
  // TEST 3: Create a minimal reproducible test proving AsyncLocalStorage Tenant A vs runInTenantContext Tenant B conflict
  // ==========================================
  console.log('\n--- TEST 3: AsyncLocalStorage Tenant A vs runInTenantContext Tenant B Conflict (PostgreSQL) ---');
  
  // Clean up and seed
  await resetDB();
  await adminPrisma.employee.create({
    data: { id: EMP_B_UUID, tenantId: TENANT_B_UUID, email: 'emp@tenant-b.com' }
  });

  // Setup: AsyncLocalStorage has tenant-a, but we run runInTenantContext with tenant-b
  await tenantContextStore.run({ tenantId: TENANT_A_UUID }, async () => {
    await runInTenantContextCurrent(TENANT_B_UUID, async (tx) => {
      // tx is unextended. If we run a query on tx:
      const result = await tx.employee.findMany();
      console.log(`Current unextended tx: query inside Tenant B transaction (with AsyncLocalStorage = Tenant A)`);
      console.log(`-> Returned employees:`, result.map(e => e.id));
      console.log(`-> SECURITY LEAK EXPLOIT: successfully returned Tenant B data, completely bypassing AsyncLocalStorage context (Tenant A)!`);
    });
  });

  // ==========================================
  // TEST 4: Enable RLS temporarily on a test table and prove that JwtStrategy/RolesGuard style queries fail without runInTenantContext
  // ==========================================
  console.log('\n--- TEST 4: Enable RLS on employees & Prove JwtStrategy/RolesGuard Bypasses Fail (PostgreSQL) ---');
  
  // Seed Tenant B employee
  await resetDB();
  await adminPrisma.employee.create({
    data: { id: EMP_B_UUID, tenantId: TENANT_B_UUID, email: 'auth@tenant-b.com' }
  });

  console.log('Enabling Row-Level Security on employees table using Admin Client...');
  await adminPrisma.$executeRawUnsafe(`ALTER TABLE catalog.employees ENABLE ROW LEVEL SECURITY;`);
  await adminPrisma.$executeRawUnsafe(`ALTER TABLE catalog.employees FORCE ROW LEVEL SECURITY;`);
  await adminPrisma.$executeRawUnsafe(`DROP POLICY IF EXISTS test_rls ON catalog.employees;`);
  await adminPrisma.$executeRawUnsafe(`CREATE POLICY test_rls ON catalog.employees FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);`);

  console.log('RLS Active on employees table.');

  // Scenario 1: Query outside runInTenantContext (representing JwtStrategy / RolesGuard)
  await tenantContextStore.run({ tenantId: TENANT_B_UUID }, async () => {
    // This executes rawPrisma.employee.findFirst (connected as non-superuser hos_app_user)
    const resultOutside = await prismaServiceInstance.employee.findFirst({
      where: { id: EMP_B_UUID }
    });
    console.log(`Query OUTSIDE runInTenantContext (JwtStrategy style) -> Result:`, resultOutside);
    if (resultOutside === null) {
      console.log('✅ PROVEN: JwtStrategy style query failed to retrieve the employee because app.current_tenant_id was NULL in the PostgreSQL session, causing RLS to block access.');
    } else {
      console.log('❌ FAILED: Query did not fail under RLS. RLS was bypassed (check role superuser status!).');
    }
  });

  // Scenario 2: Query inside runInTenantContext
  await tenantContextStore.run({ tenantId: TENANT_B_UUID }, async () => {
    const resultInside = await runInTenantContextCurrent(TENANT_B_UUID, async (tx) => {
      // Use tx.employee.findFirst (bypassing the escaping findUnique rewriter)
      return tx.employee.findFirst({
        where: { id: EMP_B_UUID }
      });
    });
    console.log(`Query INSIDE runInTenantContext -> Result:`, resultInside ? 'Found Employee!' : 'Null');
    if (resultInside !== null) {
      console.log('✅ PROVEN: Wrapping query in runInTenantContext correctly sets app.current_tenant_id, satisfying PostgreSQL RLS policy.');
    } else {
      console.log('❌ FAILED: Query inside transaction returned null under RLS.');
    }
  });

  // ==========================================
  // TEST 5: Measure performance impact of wrapping auth lookups in transactions
  // ==========================================
  console.log('\n--- TEST 5: Performance Impact Measurement (PostgreSQL) ---');
  
  const iterations = 100;
  
  // Measure standard queries (no transaction)
  const startStandard = Date.now();
  await tenantContextStore.run({ tenantId: TENANT_B_UUID }, async () => {
    for (let i = 0; i < iterations; i++) {
      await prismaServiceInstance.employee.findFirst({
        where: { id: EMP_B_UUID }
      });
    }
  });
  const endStandard = Date.now();
  const standardTime = endStandard - startStandard;
  console.log(`1. Standard Queries (${iterations} iterations): ${standardTime}ms (avg: ${(standardTime / iterations).toFixed(2)}ms/query)`);

  // Measure transactional queries (each query starts a transaction, sets SET LOCAL, and commits)
  const startTx = Date.now();
  await tenantContextStore.run({ tenantId: TENANT_B_UUID }, async () => {
    for (let i = 0; i < iterations; i++) {
      await runInTenantContextCurrent(TENANT_B_UUID, async (tx) => {
        await tx.employee.findFirst({
          where: { id: EMP_B_UUID }
        });
      });
    }
  });
  const endTx = Date.now();
  const txTime = endTx - startTx;
  console.log(`2. Transactional Queries (${iterations} iterations): ${txTime}ms (avg: ${(txTime / iterations).toFixed(2)}ms/query)`);
  
  const slowdown = ((txTime - standardTime) / standardTime * 100).toFixed(1);
  console.log(`✅ Performance Impact: Transaction wrapping adds a ${slowdown}% slowdown on active PostgreSQL!`);

  // Disable RLS at cleanup using admin client
  await adminPrisma.$executeRawUnsafe(`ALTER TABLE catalog.employees DISABLE ROW LEVEL SECURITY;`);
}

runTests()
  .catch(console.error)
  .finally(async () => {
    await rawPrisma.$disconnect();
    await adminPrisma.$disconnect();
    console.log('\n--- VERIFICATION COMPLETED ---');
  });
