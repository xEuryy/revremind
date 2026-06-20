// VERIFY CHECK — reports the test reminder status after the cron run.
// SENT (with bad sender on the store) = fix works AND is deployed.
// FAILED = old code still live or fix broken.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const shop = 'revremind-preview.myshopify.com';
const TEST_CUSTOMER_ID = 'VERIFY-FIX-20260620';

const store = await prisma.store.findUnique({ where: { shop }, select: { senderName: true, senderEmail: true } });
console.log('store sender during test:', JSON.stringify(store));

const r = await prisma.reminder.findFirst({
  where: { shop, customerId: TEST_CUSTOMER_ID }, orderBy: { scheduledFor: 'desc' },
});
console.log('reminder status:', r?.status);
console.log('sentAt:', r?.sentAt?.toISOString() ?? '-');
console.log('AI messageBody:', r?.messageBody ? r.messageBody.slice(0, 200) : '(none)');
console.log(r?.status === 'SENT'
  ? '\n>>> PASS: send succeeded despite an unverified store sender. Fix confirmed live.'
  : '\n>>> NOT YET: status is ' + r?.status + ' — deploy may still be in progress, or investigate.');
await prisma.$disconnect();
