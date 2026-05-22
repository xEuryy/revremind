import { prisma } from "../shopify.server";
import Anthropic from "@anthropic-ai/sdk";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

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
      const message = await generateReminderMessage(reminder);

      if (reminder.channel === "email") {
        await sendEmail(reminder.customerEmail, message);
      } else if (reminder.channel === "sms") {
        await sendSMS(reminder.customerEmail, message.text);
      }

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: "SENT", sentAt: now, messageBody: message.text },
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

// Schedules reminders when a customer makes a purchase
export async function scheduleRemindersForOrder(
  shop: string,
  orderId: string,
  customerEmail: string,
  customerName: string | null,
  lineItems: Array<{ productId: string; title: string }>
) {
  // Find customer vehicle profile
  const vehicle = await prisma.customerVehicle.findFirst({
    where: { shop, customerEmail },
    orderBy: { createdAt: "desc" },
  });

  if (!vehicle) return; // No vehicle registered, skip

  for (const item of lineItems) {
    const tracked = await prisma.trackedProduct.findUnique({
      where: { shop_shopifyProductId: { shop, shopifyProductId: item.productId } },
    });

    if (!tracked || tracked.category === "skip") continue;

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + tracked.intervalDays);

    await prisma.reminder.create({
      data: {
        shop,
        vehicleId: vehicle.id,
        customerId: vehicle.customerId,
        customerEmail,
        productTitle: item.title,
        productCategory: tracked.category,
        scheduledFor,
        channel: "email",
      },
    });
  }
}

async function generateReminderMessage(reminder: any) {
  const vehicle = reminder.vehicle;
  const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const categoryLabel = reminder.productCategory.replace(/_/g, " ");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Write a short, friendly maintenance reminder email for a customer.

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

async function sendEmail(
  to: string,
  message: { subject: string; text: string; html: string }
) {
  await sgMail.send({
    to,
    from: "reminders@revremind.com",
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

async function sendSMS(to: string, body: string) {
  await twilioClient.messages.create({
    body: body.substring(0, 160),
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  });
}
