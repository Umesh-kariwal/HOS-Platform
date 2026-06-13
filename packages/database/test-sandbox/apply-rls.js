const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "postgresql://postgres:SecurePassword123@127.0.0.1:5432/hos_catalog?schema=catalog"
      }
    }
  });
  await prisma.$connect();
  console.log('Connected to PostgreSQL via Prisma.');

  const sql1 = fs.readFileSync(path.join(__dirname, '../migrations/03_expand_rls.sql'), 'utf8');
  const statements1 = sql1.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
  for (const stmt of statements1) {
    await prisma.$executeRawUnsafe(stmt);
  }
  console.log('Applied 03_expand_rls.sql');

  const sql2 = fs.readFileSync(path.join(__dirname, '../migrations/04_maintenance_rls.sql'), 'utf8');
  const statements2 = sql2.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
  for (const stmt of statements2) {
    await prisma.$executeRawUnsafe(stmt);
  }
  console.log('Applied 04_maintenance_rls.sql');

  await prisma.$disconnect();
}
main().catch(console.error);
