// Deliverability test — send to a fresh +alias (not suppressed) to confirm
// whether the plain address is suppressed vs a real delivery failure.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const shop = 'revremind-preview.myshopify.com';
const CID = 'DELIVER-TEST';
const recipient = 'michael.d.eury+revdemo@gmail.com';
const PROD = 'https://revremind-production.up.railway.app/api/cron';
const SECRET = process.env.CRON_SECRET;

let v = await prisma.customerVehicle.findFirst({ where: { shop, customerId: CID } });
if (!v) v = await prisma.customerVehicle.create({ data: { shop, customerId: CID, customerEmail: recipient, customerName: 'Jordan Miller', year: 2021, make: 'Toyota', model: 'Camry' } });
await prisma.reminder.deleteMany({ where: { shop, customerId: CID } });
await prisma.reminder.create({ data: { shop, vehicleId: v.id, customerId: CID, customerEmail: recipient, productTitle: 'Synthetic Motor Oil 5W-30 (1 Qt)', productCategory: 'oil_filter', scheduledFor: new Date(Date.now() - 86_400_000), status: 'PENDING', channel: 'email' } });
console.log('seeded reminder to', recipient);

const res = await fetch(PROD, { method: 'POST', headers: { Authorization: `Bearer ${SECRET}` } });
console.log('cron:', res.status, await res.text());
const r = await prisma.reminder.findFirst({ where: { shop, customerId: CID } });
console.log('reminder status:', r?.status, 'sentAt:', r?.sentAt?.toISOString() ?? '-');
await prisma.$disconnect();
