// VERIFY RUN — end-to-end proof the fix works on live production.
// Seeds the reviewer's breaking condition (unverified store sender), then loops:
// reset reminder -> POST live /api/cron -> check status. Retries across the
// Railway deploy window. SENT = fix works on prod with real Anthropic+SendGrid.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const shop = 'revremind-preview.myshopify.com';
const TEST_CUSTOMER_ID = 'VERIFY-FIX-20260620';
const recipient = 'michael.d.eury@gmail.com';
const BAD_SENDER = 'owner@autoshop-demo-unverified.com';
const PROD = 'https://revremind-production.up.railway.app/api/cron';
const SECRET = process.env.CRON_SECRET;

async function seed() {
  await prisma.store.update({ where: { shop }, data: { senderName: 'Demo Auto Shop', senderEmail: BAD_SENDER } });
  await prisma.trackedProduct.upsert({
    where: { shop_shopifyProductId: { shop, shopifyProductId: 'gid://shopify/Product/VERIFY-FIX' } },
    update: { isActive: true },
    create: { shop, shopifyProductId: 'gid://shopify/Product/VERIFY-FIX',
      productTitle: 'Synthetic Motor Oil 5W-30 (1 Qt)', category: 'oil_filter', intervalDays: 90, isActive: true },
  });
  let v = await prisma.customerVehicle.findFirst({ where: { shop, customerId: TEST_CUSTOMER_ID } });
  if (!v) v = await prisma.customerVehicle.create({ data: { shop, customerId: TEST_CUSTOMER_ID,
    customerEmail: recipient, customerName: 'Verify Fix Customer', year: 2021, make: 'Toyota', model: 'Camry' } });
  const existing = await prisma.reminder.findFirst({ where: { shop, customerId: TEST_CUSTOMER_ID } });
  if (!existing) await prisma.reminder.create({ data: { shop, vehicleId: v.id, customerId: TEST_CUSTOMER_ID,
    customerEmail: recipient, productTitle: 'Synthetic Motor Oil 5W-30 (1 Qt)', productCategory: 'oil_filter',
    scheduledFor: new Date(Date.now() - 86_400_000), status: 'PENDING', channel: 'email' } });
  console.log(`seeded: store sender = UNVERIFIED "${BAD_SENDER}", due reminder -> ${recipient}`);
}

async function resetReminder() {
  await prisma.reminder.updateMany({ where: { shop, customerId: TEST_CUSTOMER_ID }, data: { status: 'PENDING', sentAt: null, messageBody: null } });
}

async function runCron() {
  const res = await fetch(PROD, { method: 'POST', headers: { Authorization: `Bearer ${SECRET}` } });
  const body = await res.text();
  return `HTTP ${res.status} ${body}`;
}

async function status() {
  const r = await prisma.reminder.findFirst({ where: { shop, customerId: TEST_CUSTOMER_ID }, orderBy: { scheduledFor: 'desc' } });
  return r;
}

await seed();
let pass = false;
for (let i = 1; i <= 8; i++) {
  await resetReminder();
  const cron = await runCron();
  const r = await status();
  console.log(`attempt ${i}: cron=${cron} | reminder=${r?.status} sentAt=${r?.sentAt?.toISOString() ?? '-'}`);
  if (cron.startsWith('HTTP 401')) { console.log('CRON_SECRET mismatch with production — stopping.'); break; }
  if (r?.status === 'SENT') {
    pass = true;
    console.log('AI messageBody:', r.messageBody?.slice(0, 220));
    break;
  }
  if (i < 8) { console.log('  not sent yet (deploy may be mid-flight) — waiting 30s'); await new Promise(res => setTimeout(res, 30_000)); }
}
console.log(pass
  ? '\n>>> PASS: live production send succeeded with an UNVERIFIED store sender. Recurring failure is fixed.'
  : '\n>>> FAIL: did not reach SENT. Investigate before resubmitting.');
await prisma.$disconnect();
