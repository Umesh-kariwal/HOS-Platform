const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../../../apps/api/dist/app.module');
const { MessageController } = require('../../../apps/api/dist/message/message.controller');
const { InventoryController } = require('../../../apps/api/dist/inventory/inventory.controller');
const { FoliosController } = require('../../../apps/api/dist/folios/folios.controller');
const { PrismaClient } = require('@prisma/client');

process.env.DATABASE_URL = "postgresql://postgres:SecurePassword123@127.0.0.1:5432/hos_catalog?schema=catalog";

const prisma = new PrismaClient();

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000002';

const EMP_MGR_ID = '11111111-1111-1111-1111-111111111111';
const EMP_REC_ID = '11111111-1111-1111-1111-111111111112';

const MOCK_REQ_REC = {
  user: {
    employeeId: EMP_REC_ID,
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    role: 'Front Desk'
  }
};

const MOCK_REQ_MGR = {
  user: {
    employeeId: EMP_MGR_ID,
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    role: 'Manager'
  }
};

async function test() {
  console.log('================================================================');
  console.log('    HOS MESSAGING & INVENTORY BACKEND INTEGRATION VALIDATION');
  console.log('================================================================');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const messageController = app.get(MessageController);
  const inventoryController = app.get(InventoryController);
  const foliosController = app.get(FoliosController);

  try {
    // 1. Database Cleanup
    console.log('\nCleaning up messaging and inventory tables...');
    await prisma.message.deleteMany();
    await prisma.stockLevel.deleteMany();
    await prisma.inventoryLocation.deleteMany();
    await prisma.item.deleteMany();

    // 2. Messaging Integration Checks
    console.log('\n--- 2. Testing Messaging Endpoints ---');

    console.log('Sending message from Receptionist to Manager...');
    const msg = await messageController.sendMessage(MOCK_REQ_REC, {
      recipientId: EMP_MGR_ID,
      content: 'Hello Manager, towels are running low on Floor 2.'
    });
    console.log(`-> Success! Message sent with ID: ${msg.id}`);

    console.log('Fetching conversations list for Receptionist...');
    const recList = await messageController.getConversations(MOCK_REQ_REC);
    console.log(`-> Success! Found ${recList.length} conversations.`);
    const mgrConv = recList.find(c => c.employee.id === EMP_MGR_ID);
    console.log(`   Manager Last Message: "${mgrConv.lastMessage.content}" | Unread count for Rec: ${mgrConv.unreadCount}`);
    if (mgrConv.unreadCount !== 0) {
      throw new Error('Unread count for sender should be 0');
    }

    console.log('Fetching conversations list for Manager...');
    const mgrList = await messageController.getConversations(MOCK_REQ_MGR);
    const recConv = mgrList.find(c => c.employee.id === EMP_REC_ID);
    console.log(`   Receptionist Last Message: "${recConv.lastMessage.content}" | Unread count for Mgr: ${recConv.unreadCount}`);
    if (recConv.unreadCount !== 1) {
      throw new Error('Unread count for recipient should be 1');
    }

    console.log('Fetching conversation logs between Manager and Receptionist...');
    const history = await messageController.getConversation(MOCK_REQ_MGR, EMP_REC_ID);
    console.log(`-> Success! Retrieved ${history.length} messages.`);
    if (history[0].id !== msg.id) {
      throw new Error('Message ID mismatch in history log');
    }

    console.log('Marking message as read by Manager...');
    await messageController.markAsRead(MOCK_REQ_MGR, msg.id);
    console.log('-> Success! Message marked as read.');

    console.log('Re-fetching conversations list for Manager to verify unread count cleared...');
    const mgrListAfter = await messageController.getConversations(MOCK_REQ_MGR);
    const recConvAfter = mgrListAfter.find(c => c.employee.id === EMP_REC_ID);
    console.log(`   Receptionist unread count now: ${recConvAfter.unreadCount}`);
    if (recConvAfter.unreadCount !== 0) {
      throw new Error('Unread count for recipient should now be 0');
    }

    // 3. Inventory Integration Checks
    console.log('\n--- 3. Testing Inventory Endpoints ---');

    console.log('Creating location "Lobby Pantry"...');
    const loc = await inventoryController.createLocation(MOCK_REQ_REC, { name: 'Lobby Pantry' });
    console.log(`-> Success! Created location with ID: ${loc.id}`);

    console.log('Creating catalog item "COKE-01" (Coca-Cola)...');
    const item = await inventoryController.createItem(MOCK_REQ_REC, {
      sku: 'COKE-01',
      name: 'Coca-Cola Light',
      category: 'beverage',
      safetyStockThreshold: 5
    });
    console.log(`-> Success! Created item with ID: ${item.id}`);

    console.log('Adjusting stock level of COKE-01 at Lobby Pantry to 50...');
    const stock = await inventoryController.adjustStock(MOCK_REQ_REC, {
      inventoryLocationId: loc.id,
      itemId: item.id,
      quantity: 50
    });
    console.log(`-> Success! Stock set to: ${stock.quantity}`);

    console.log('Listing inventory locations and verifying stock level...');
    const locationsList = await inventoryController.listLocations(MOCK_REQ_REC);
    const checkLoc = locationsList.find(l => l.id === loc.id);
    const checkStock = checkLoc.stockLevels.find(s => s.itemId === item.id);
    console.log(`-> Location: ${checkLoc.name} | SKU: ${checkStock.item.sku} | Quantity: ${checkStock.quantity}`);
    if (checkStock.quantity !== 50) {
      throw new Error('Stock quantity mismatch');
    }

    // 4. Minibar Consumption and Folio Billing Integration Checks
    console.log('\n--- 4. Testing Minibar Consumption & Folio Auto-Billing ---');

    // Setup guest checkout mock booking & folio
    console.log('Setting up mock checked-in guest booking for Room 101...');
    // Clean old transactions first
    await prisma.valetTicket.deleteMany();
    await prisma.visitorRecord.deleteMany();
    await prisma.serviceRequest.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.billingRoutingRule.deleteMany();
    await prisma.folio.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.guest.deleteMany();

    const guest = await prisma.guest.create({
      data: {
        tenantId: TENANT_ID,
        firstName: 'Test',
        lastName: 'MinibarGuest',
        email: 'minibar@guest.com'
      }
    });

    const booking = await prisma.booking.create({
      data: {
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        guestId: guest.id,
        roomId: '55555555-5555-5555-5555-555555555551', // Room 101
        checkInDate: new Date('2026-06-14'),
        checkOutDate: new Date('2026-06-16'),
        status: 'checked_in'
      }
    });

    const folio = await prisma.folio.create({
      data: {
        tenantId: TENANT_ID,
        bookingId: booking.id,
        payerType: 'guest',
        status: 'open'
      }
    });
    console.log(`-> Mock Setup: Booking ID ${booking.id} | Folio ID ${folio.id} | Room 101 Checked-In`);

    // Create room minibar location and set stock to 10 COKE-01
    const minibarLocName = 'Room 101 Minibar';
    const mbLoc = await prisma.inventoryLocation.create({
      data: {
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        name: minibarLocName,
        isActive: true
      }
    });
    
    await prisma.stockLevel.create({
      data: {
        tenantId: TENANT_ID,
        inventoryLocationId: mbLoc.id,
        itemId: item.id,
        quantity: 10
      }
    });
    console.log(`-> Pre-stocking Room 101 Minibar with 10 units of COKE-01`);

    console.log('Triggering minibar consumption of 2 x COKE-01 at $4.50...');
    const billingResult = await inventoryController.consumeMinibar(MOCK_REQ_REC, {
      roomNumber: '101',
      sku: 'COKE-01',
      quantity: 2,
      unitPrice: 4.5
    });
    console.log('-> Response:', JSON.stringify(billingResult, null, 2));

    if (!billingResult.success) {
      throw new Error('Minibar consumption endpoint returned failure');
    }

    console.log('Verifying stock level decremented in minibar...');
    const updatedStock = await prisma.stockLevel.findUnique({
      where: {
        uq_location_item: {
          tenantId: TENANT_ID,
          inventoryLocationId: mbLoc.id,
          itemId: item.id
        }
      }
    });
    console.log(`   Remaining Stock Level: ${updatedStock.quantity} (Expected: 8)`);
    if (updatedStock.quantity !== 8) {
      throw new Error(`Expected remaining stock to be 8, got ${updatedStock.quantity}`);
    }

    console.log('Verifying folio ledger entries and balance updates...');
    const folioDetails = await foliosController.getFolioById(folio.id);
    console.log('-> Folio Details:', JSON.stringify(folioDetails, null, 2));

    const minibarCharge = folioDetails.ledgerEntries.find(e => e.type === 'minibar');
    if (!minibarCharge) {
      throw new Error('No charge of type "minibar" posted to folio');
    }
    console.log(`   Posted Charge: "${minibarCharge.description}" | Amount: $${minibarCharge.amount}`);
    if (Number(minibarCharge.amount) !== 9.0) {
      throw new Error(`Expected charge amount of $9.00, got ${minibarCharge.amount}`);
    }

    console.log('\n✅ ALL MESSAGING & INVENTORY INTEGRATION TESTS PASSED!');
    await app.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ INTEGRATION TEST FAILED:', err.message);
    await app.close();
    process.exit(1);
  }
}

test();
