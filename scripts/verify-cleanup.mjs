// VERIFY CLEANUP — restores the preview store to clean zeros for the reviewer:
// null sender, and removes all VERIFY-FIX test rows.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const shop = 'revremind-preview.myshopify.com';
const TEST_CUSTOMER_ID = 'VERIFY-FIX-20260620';

await prisma.reminder.deleteMany({ where: { shop, customerId: TEST_CUSTOMER_ID } });
await prisma.customerVehicle.deleteMany({ where: { shop, customerId: TEST_CUSTOMER_ID } });
await prisma.trackedProduct.deleteMany({ where: { shop, shopifyProductId: 'gid://shopify/Product/VERIFY-FIX' } });
await prisma.store.update({ where: { shop }, data: { senderName: null, senderEmail: null } });

const store = await prisma.store.findUnique({ where: { shop }, select: { senderName: true, senderEmail: true } });
const counts = {
  reminders: await prisma.reminder.count({ where: { shop } }),
  vehicles: await prisma.customerVehicle.count({ where: { shop } }),
  products: await prisma.trackedProduct.count({ where: { shop } }),
};
console.log('preview store sender reset:', JSON.stringify(store));
console.log('preview store remaining rows:', JSON.stringify(counts));
console.log('CLEANUP OK');
await prisma.$disconnect();
