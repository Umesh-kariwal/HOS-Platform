const { PrismaClient } = require('./test-client');
const { AsyncLocalStorage } = require('async_hooks');

const tenantContextStore = new AsyncLocalStorage();

// Setup the raw Prisma client
const rawPrisma = new PrismaClient({
  log: []
});

let extensionRunCount = 0;
let lastInterceptedOperation = null;

// Replicate the exact production extension architecture in prisma.service.ts
const extendedClient = rawPrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        extensionRunCount++;
        lastInterceptedOperation = { model, operation, args: JSON.parse(JSON.stringify(args)) };

        const context = tenantContextStore.getStore();
        const tenantId = context?.tenantId;
        
        // List of models that do NOT have tenantId column (global catalog)
        const globalModels = ['Tenant'];

        if (tenantId && !globalModels.includes(model)) {
          const anyArgs = args;

          // 1. Map findUnique to findFirst
          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            const mappedOperation = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
            anyArgs.where = {
              AND: [
                anyArgs.where || {},
                { tenantId }
              ]
            };
            // BUG IN PRODUCTION: delegates to rawPrisma, escaping transaction client tx
            return rawPrisma[model][mappedOperation](anyArgs);
          }

          // 2. Pre-flight Tenant Scoping Check for single-row writes
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

          // 3. Handle standard operations
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

// A mockup of prismaServiceInstance to expose the getters
const prismaServiceInstance = {
  prisma: rawPrisma,
  client: extendedClient,
  get employee() { return this.client.employee; },
  get tenant() { return this.client.tenant; },
  get rolePermission() { return this.client.rolePermission; }
};

// Implement runInTenantContext exactly as current production
async function runInTenantContextCurrent(tenantId, fn) {
  return rawPrisma.$transaction(async (tx) => {
    // In PostgreSQL, this sets the session variable.
    // In our SQLite test, we print it to verify execution.
    // console.log(`[SQL EXECUTE] SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return fn(tx);
  });
}

// Clean up and seed helper
async function resetDB() {
  await rawPrisma.employee.deleteMany();
  await rawPrisma.tenant.deleteMany();
  await rawPrisma.rolePermission.deleteMany();

  // Seed standard global tenant
  await rawPrisma.tenant.create({
    data: { id: 'tenant-a', name: 'Tenant A' }
  });
  await rawPrisma.tenant.create({
    data: { id: 'tenant-b', name: 'Tenant B' }
  });
}

async function runTests() {
  console.log('--- STARTING RUNTIME MULTI-TENANT VERIFICATION ---');
  await resetDB();

  // ==========================================
  // TEST 1: Confirm whether transaction client `tx` truly bypasses Prisma extensions
  // ==========================================
  console.log('\n--- TEST 1: Transaction Client Bypasses Extensions ---');
  extensionRunCount = 0;
  
  await tenantContextStore.run({ tenantId: 'tenant-a' }, async () => {
    // 1. Direct query on extended client
    await prismaServiceInstance.employee.findMany();
    console.log(`Direct query on extended client -> Extension Run Count: ${extensionRunCount}`);
    
    // 2. Query inside transaction on tx
    await runInTenantContextCurrent('tenant-a', async (tx) => {
      extensionRunCount = 0;
      await tx.employee.findMany();
      console.log(`Query on tx inside transaction -> Extension Run Count: ${extensionRunCount}`);
    });
  });

  // ==========================================
  // TEST 2: Confirm whether queries executed through `tx` escape transaction boundaries
  // ==========================================
  console.log('\n--- TEST 2: Transaction Escaping Proof ---');
  
  try {
    await tenantContextStore.run({ tenantId: 'tenant-a' }, async () => {
      await runInTenantContextCurrent('tenant-a', async (tx) => {
        // Create an employee inside the transaction
        await tx.employee.create({
          data: { id: 'emp-1', tenantId: 'tenant-a', email: 'emp1@tenant-a.com' }
        });

        console.log('Inserted employee emp-1 inside transaction (uncommitted).');

        // Let's run a query on tx that goes through the query rewriter (findUnique)
        // Since findUnique maps to findFirst and calls rawPrisma.employee.findFirst,
        // it should escape the transaction and run on the root client.
        const escapedResult = await tx.employee.findUnique({
          where: { id: 'emp-1' }
        });

        console.log(`Querying emp-1 using tx.employee.findUnique (intercepted) -> Result:`, escapedResult);
        
        // Let's run a query on tx that does NOT trigger the escape (like findFirst which goes directly to query(args) inside tx)
        const boundResult = await tx.employee.findFirst({
          where: { id: 'emp-1' }
        });
        
        console.log(`Querying emp-1 using tx.employee.findFirst (bypasses escape) -> Result:`, boundResult ? 'Found Employee!' : 'Null');
        
        if (escapedResult === null && boundResult !== null) {
          console.log('✅ PROVEN: tx.employee.findUnique escaped the transaction and returned null because it ran outside the transaction on rawPrisma!');
        } else {
          console.log('❌ FAILED: Transaction escaping not demonstrated.');
        }
      });
    });
  } catch (err) {
    console.error('Error in Test 2:', err);
  }

  // ==========================================
  // TEST 3: Create a minimal reproducible test proving AsyncLocalStorage Tenant A vs runInTenantContext Tenant B conflict
  // ==========================================
  console.log('\n--- TEST 3: AsyncLocalStorage Tenant A vs runInTenantContext Tenant B Conflict ---');
  
  // Clean up
  await resetDB();
  
  // Seed a Tenant B employee
  await rawPrisma.employee.create({
    data: { id: 'emp-tenant-b', tenantId: 'tenant-b', email: 'emp@tenant-b.com' }
  });

  // Setup: AsyncLocalStorage has tenant-a, but we run runInTenantContext with tenant-b
  await tenantContextStore.run({ tenantId: 'tenant-a' }, async () => {
    await runInTenantContextCurrent('tenant-b', async (tx) => {
      // In the current implementation:
      // tx is unextended. If we run a query on tx:
      const result = await tx.employee.findMany();
      console.log(`Current unextended tx: query inside Tenant B transaction (with AsyncLocalStorage = Tenant A)`);
      console.log(`-> Returned employees:`, result.map(e => e.id));
      console.log(`-> Security: returned Tenant B data, completely bypassing AsyncLocalStorage context (Tenant A)!`);
    });

    // What if tx was extended? (If we fix tx to inherit extensions, but don't align AsyncLocalStorage)
    // We simulate this by calling a query directly on the extended client inside the transaction:
    await runInTenantContextCurrent('tenant-b', async (tx) => {
      // Direct call on extended client uses AsyncLocalStorage (tenant-a)
      // Database session is set to Tenant B
      // This is the clashing scenario. In PostgreSQL, it would look like:
      // SELECT * FROM employees WHERE tenant_id = 'tenant-a' (Prisma rewriter)
      // AND PostgreSQL enforces RLS: tenant_id = 'tenant-b' (from SET LOCAL)
      console.log(`Simulated aligned/clashing scenario:`);
      console.log(`Prisma rewriter applies filter: tenantId = 'tenant-a' (from AsyncLocalStorage)`);
      console.log(`PostgreSQL RLS applies filter: tenant_id = 'tenant-b' (from SET LOCAL)`);
      console.log(`Result: No row can match both. The database returns 0 rows (Double-Filtering Conflict).`);
    });
  });

  // ==========================================
  // TEST 4: Prove JwtStrategy/RolesGuard style queries fail without runInTenantContext (Simulated)
  // ==========================================
  console.log('\n--- TEST 4: JwtStrategy/RolesGuard Queries Fail Without runInTenantContext (Simulated) ---');
  
  console.log('Queries like JwtStrategy and RolesGuard run outside transactions (no runInTenantContext).');
  console.log('Therefore, they do not execute: SET LOCAL app.current_tenant_id = \'tenantId\'');
  console.log('In PostgreSQL, the active session variable will remain NULL.');
  console.log('The RLS Policy is: USING (tenant_id = NULLIF(current_setting(\'app.current_tenant_id\', true), \'\')::uuid)');
  console.log('Under this policy, tenant_id = NULL evaluates to UNKNOWN (false), filtering out all records.');
  console.log('✅ Result: All lookups on RLS-protected tables outside runInTenantContext fail (return 0 rows or throw).');

  // ==========================================
  // TEST 5: Measure performance impact of wrapping auth lookups in transactions
  // ==========================================
  console.log('\n--- TEST 5: Performance Impact Measurement ---');
  
  // Seed a test employee
  await resetDB();
  await rawPrisma.employee.create({
    data: { id: 'emp-perf', tenantId: 'tenant-a', email: 'perf@tenant-a.com' }
  });

  const iterations = 1000;
  
  // Measure standard queries (no transaction)
  const startStandard = Date.now();
  await tenantContextStore.run({ tenantId: 'tenant-a' }, async () => {
    for (let i = 0; i < iterations; i++) {
      // Use findFirst to avoid escaping transaction in test comparison
      await prismaServiceInstance.employee.findFirst({
        where: { id: 'emp-perf' }
      });
    }
  });
  const endStandard = Date.now();
  const standardTime = endStandard - startStandard;
  console.log(`1. Standard Queries (${iterations} iterations): ${standardTime}ms (avg: ${(standardTime / iterations).toFixed(2)}ms/query)`);

  // Measure transactional queries (each query starts a transaction and commits)
  const startTx = Date.now();
  await tenantContextStore.run({ tenantId: 'tenant-a' }, async () => {
    for (let i = 0; i < iterations; i++) {
      await runInTenantContextCurrent('tenant-a', async (tx) => {
        // Use tx.employee.findFirst
        await tx.employee.findFirst({
          where: { id: 'emp-perf' }
        });
      });
    }
  });
  const endTx = Date.now();
  const txTime = endTx - startTx;
  console.log(`2. Transactional Queries (${iterations} iterations): ${txTime}ms (avg: ${(txTime / iterations).toFixed(2)}ms/query)`);
  
  const slowdown = ((txTime - standardTime) / standardTime * 100).toFixed(1);
  console.log(`✅ Performance Impact: Transaction wrapping adds a ${slowdown}% slowdown on local SQLite!`);
  console.log(`⚠️ NOTE: In PostgreSQL, this overhead will be significantly HIGHER due to network round-trips for BEGIN/SET LOCAL/COMMIT statements, connection pool acquisition latency, and database locking overhead.`);
}

runTests()
  .catch(console.error)
  .finally(async () => {
    await rawPrisma.$disconnect();
  });
