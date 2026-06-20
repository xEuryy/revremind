// VERIFY SETUP — reproduces the reviewer's exact breaking condition:
// sets the preview store's sender email to an ARBITRARY UNVERIFIED address,
// then seeds a DUE reminder to Michael's inbox. Under the old code this send
// would be rejected by SendGrid (403). Under the fix it must send from
// rev-remind.com with the bad address as reply-to.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const shop = 'revremind-preview.myshopify.com';
const TEST_CUSTOMER_ID = 'VERIFY-FIX-20260620';
const recipient = 'michael.d.eury@gmail.com';
const BAD_SENDER = 'owner@autoshop-demo-unverified.com'; // not verified, not our domain

async function main() {
  // 1. Set the store to the reviewer-style bad sender
  await prisma.store.update({
    where: { shop },
    data: { senderName: 'Demo Auto Shop', senderEmail: BAD_SENDER },
  });
  console.log(`store sender set to UNVERIFIED: name="Demo Auto Shop" email="${BAD_SENDER}"`);

  // 2. Tracked product
  await prisma.trackedProduct.upsert({
    where: { shop_shopifyProductId: { shop, shopifyProductId: 'gid://shopify/Product/VERIFY-FIX' } },
    update: { isActive: true },
    create: {
      shop, shopifyProductId: 'gid://shopify/Product/VERIFY-FIX',
      productTitle: 'Synthetic Motor Oil 5W-30 (1 Qt)', category: 'oil_filter',
      intervalDays: 90, isActive: true,
    },
  });

  // 3. Vehicle
  let vehicle = await prisma.customerVehicle.findFirst({ where: { shop, customerId: TEST_CUSTOMER_ID } });
  if (!vehicle) {
    vehicle = await prisma.customerVehicle.create({
      data: { shop, customerId: TEST_CUSTOMER_ID, customerEmail: recipient,
        customerName: 'Verify Fix Customer', year: 2021, make: 'Toyota', model: 'Camry' },
    });
  }
  console.log('vehicle:', `${vehicle.year} ${vehicle.make} ${vehicle.model}`);

  // 4. Due pending reminder
  const reminder = await prisma.reminder.create({
    data: {
      shop, vehicleId: vehicle.id, customerId: TEST_CUSTOMER_ID, customerEmail: recipient,
      productTitle: 'Synthetic Motor Oil 5W-30 (1 Qt)', productCategory: 'oil_filter',
      scheduledFor: new Date(Date.now() - 86_400_000), status: 'PENDING', channel: 'email',
    },
  });
  console.log('reminder seeded:', reminder.id, 'status:', reminder.status);
  console.log('SETUP OK — now POST to prod /api/cron');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
