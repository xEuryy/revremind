import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import sgMail from '@sendgrid/mail';

const prisma = new PrismaClient();

function mask(v) {
  if (!v) return '(missing)';
  return `${v.slice(0, 6)}...${v.slice(-4)} (len ${v.length})`;
}

console.log('=== ENV PRESENCE (masked) ===');
console.log('ANTHROPIC_API_KEY:', mask(process.env.ANTHROPIC_API_KEY));
console.log('SENDGRID_API_KEY :', mask(process.env.SENDGRID_API_KEY));
console.log('DATABASE_URL host:', (process.env.DATABASE_URL || '').replace(/:[^:@/]+@/, ':***@').split('@')[1] || '(missing)');

console.log('\n=== STORES IN PROD DB ===');
const stores = await prisma.store.findMany({
  orderBy: { installedAt: 'desc' },
  select: { shop: true, installedAt: true, isActive: true, senderName: true, senderEmail: true, smsEnabled: true },
});
for (const s of stores) {
  console.log(`- ${s.shop} | installed ${s.installedAt?.toISOString()} | active=${s.isActive} | senderName=${JSON.stringify(s.senderName)} senderEmail=${JSON.stringify(s.senderEmail)} sms=${s.smsEnabled}`);
}

console.log('\n=== RECENT REMINDERS (last 20 by anything) ===');
const reminders = await prisma.reminder.findMany({
  orderBy: { scheduledFor: 'desc' },
  take: 20,
  include: { vehicle: true },
});
for (const r of reminders) {
  console.log(`- [${r.status}] shop=${r.shop} to=${r.customerEmail} sched=${r.scheduledFor?.toISOString()} sent=${r.sentAt?.toISOString() ?? '-'} channel=${r.channel} body=${r.messageBody ? 'yes' : 'none'} vehicle=${r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : 'MISSING'}`);
}

console.log('\n=== LIVE TEST: Anthropic (exact app call) ===');
try {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: 'Write a short friendly maintenance reminder for a 2022 Ford F-150 oil filter. 2-3 sentences. No em dashes.' }],
  });
  const text = resp.content[0]?.type === 'text' ? resp.content[0].text.trim() : '';
  console.log('Anthropic OK. text length:', text.length);
} catch (e) {
  console.log('Anthropic FAILED:', e?.status ?? '', e?.message ?? e);
  if (e?.error) console.log('  detail:', JSON.stringify(e.error));
}

console.log('\n=== LIVE TEST: SendGrid (exact app payload, real send) ===');
try {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const [resp] = await sgMail.send({
    to: 'michael.d.eury@gmail.com',
    from: { name: 'RevRemind', email: 'reminders@rev-remind.com' },
    subject: 'DIAG: RevRemind send path test',
    text: 'Diagnostic test of the exact app send path. If you see this, SendGrid + domain auth are working.',
    html: '<p>Diagnostic test of the exact app send path.</p>',
  });
  console.log('SendGrid OK. statusCode:', resp?.statusCode);
} catch (e) {
  console.log('SendGrid FAILED:', e?.code ?? '', e?.message ?? e);
  if (e?.response?.body) console.log('  detail:', JSON.stringify(e.response.body));
}

await prisma.$disconnect();
