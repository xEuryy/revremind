import { prisma } from "../shopify.server";
import Anthropic from "@anthropic-ai/sdk";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";

// ─── Lazy client getters ──────────────────────────────────────────────────────
// Clients are created on first use so the app doesn't crash at startup
// when env vars haven't been added yet.

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

let _twilioClient: ReturnType<typeof twilio> | null = null;
function getTwilio(): ReturnType<typeof twilio> {
  if (!_twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error("TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not set");
    }
    _twilioClient = twilio(sid, token);
  }
  return _twilioClient;
}

function getSendGrid(): typeof sgMail {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SENDGRID_API_KEY is not set");
  sgMail.setApiKey(key);
  return sgMail;
}

// ─── Cron entry point ─────────────────────────────────────────────────────────

// Called by daily cron job — checks all stores for due reminders
export async function processDueReminders() {
  const now = new Date();

  const dueReminders = await prisma.reminder.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
    },
    include: { vehicle: true },
    take: 500,
  });

  console.log(`Processing ${dueReminders.length} due reminders`);

  for (const reminder of dueReminders) {
    try {
      // Load store settings for this reminder's shop
      const store = await prisma.store.findUnique({
        where: { shop: reminder.shop },
        select: { senderName: true, senderEmail: true, smsEnabled: true },
      });

      const useSms =
        store?.smsEnabled &&
        reminder.customerPhone &&
        hasTwilioCreds();

      const message = await generateReminderMessage(reminder);

      if (useSms) {
        await sendSMS(reminder.customerPhone!, message.text);
      } else {
        await sendEmail(
          reminder.customerEmail,
          message,
          store?.senderName ?? "RevRemind",
          store?.senderEmail ?? "michael.d.eury@gmail.com"
        );
      }

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: "SENT",
          sentAt: now,
          messageBody: message.text,
        },
      });
    } catch (error) {
      console.error(`Failed to send reminder ${reminder.id}:`, error);
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: "FAILED" },
      });
    }
  }
}

// ─── AI message generation ────────────────────────────────────────────────────

async function generateReminderMessage(reminder: {
  vehicle: { year: number; make: string; model: string };
  productTitle: string;
  productCategory: string;
}) {
  const { vehicle } = reminder;
  const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const categoryLabel = reminder.productCategory.replace(/_/g, " ");

  const response = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Write a short, friendly maintenance reminder for a customer.

Vehicle: ${vehicleStr}
Product purchased: ${reminder.productTitle}
Maintenance type: ${categoryLabel}

Requirements:
- 2-3 sentences maximum
- Friendly and helpful, not pushy
- Mention the specific vehicle
- No em dashes
- End with a call to action to reorder

Output only the message body, no subject line.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  return {
    subject: `Time to check your ${vehicleStr}'s ${categoryLabel}`,
    text,
    html: `<p>${text.replace(/\n/g, "<br>")}</p>`,
  };
}

// ─── Delivery ─────────────────────────────────────────────────────────────────

async function sendEmail(
  to: string,
  message: { subject: string; text: string; html: string },
  fromName: string,
  fromEmail: string
) {
  await getSendGrid().send({
    to,
    from: { name: fromName, email: fromEmail },
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

async function sendSMS(to: string, body: string) {
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) throw new Error("TWILIO_PHONE_NUMBER is not set");

  await getTwilio().messages.create({
    body: body.substring(0, 160),
    from: fromNumber,
    to,
  });
}

// ─── Manual send (used by "Send pending reminders now" on Reminders page) ─────
// Processes ALL pending reminders for a specific shop, regardless of scheduledFor.
// Used when a merchant wants to send reminders immediately rather than waiting
// for the daily cron.

export async function processPendingRemindersForShop(shop: string): Promise<number> {
  const now = new Date();

  const pending = await prisma.reminder.findMany({
    where: { shop, status: "PENDING" },
    include: { vehicle: true },
    take: 100,
  });

  let sent = 0;

  for (const reminder of pending) {
    try {
      const store = await prisma.store.findUnique({
        where: { shop },
        select: { senderName: true, senderEmail: true, smsEnabled: true },
      });

      const useSms =
        store?.smsEnabled &&
        reminder.customerPhone &&
        hasTwilioCreds();

      const message = await generateReminderMessage(reminder);

      if (useSms) {
        await sendSMS(reminder.customerPhone!, message.text);
      } else {
        await sendEmail(
          reminder.customerEmail,
          message,
          store?.senderName ?? "RevRemind",
          store?.senderEmail ?? "michael.d.eury@gmail.com"
        );
      }

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: "SENT", sentAt: now, messageBody: message.text },
      });

      sent++;
    } catch (error) {
      console.error(`Failed to send reminder ${reminder.id}:`, error);
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: "FAILED" },
      });
    }
  }

  return sent;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasTwilioCreds(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}
