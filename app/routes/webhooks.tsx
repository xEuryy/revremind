import { authenticate, prisma } from "../shopify.server";
import type { ActionFunctionArgs } from "@remix-run/node";

type NoteAttribute = { name: string; value: string };
type LineItem = { product_id: number | null; title: string };
type OrderPayload = {
  id: number;
  customer?: {
    id: number;
    email: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
  };
  note_attributes?: NoteAttribute[];
  line_items?: LineItem[];
};

type CustomersDataRequestPayload = {
  customer: { id: number; email: string; phone?: string };
  orders_requested: number[];
};

type CustomersRedactPayload = {
  customer: { id: number; email: string; phone?: string };
  orders_to_redact: number[];
};

type ShopRedactPayload = {
  shop_id: number;
  shop_domain: string;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await prisma.store.updateMany({
          where: { shop },
          data: { isActive: false },
        });
      }
      break;

    case "ORDERS_PAID": {
      const order = payload as OrderPayload;
      const attrs = order.note_attributes ?? [];
      const year = attrs.find((a) => a.name === "_vehicle_year")?.value;
      const make = attrs.find((a) => a.name === "_vehicle_make")?.value;
      const model = attrs.find((a) => a.name === "_vehicle_model")?.value;

      // Skip if customer didn't fill in vehicle info
      if (!year || !make || !model || !order.customer) break;

      const customer = order.customer;
      const yearInt = parseInt(year, 10);
      if (isNaN(yearInt)) break;

      // Find or create the vehicle profile
      const existing = await prisma.customerVehicle.findFirst({
        where: {
          shop,
          customerId: String(customer.id),
          year: yearInt,
          make,
          model,
        },
      });

      const vehicle = existing
        ? existing
        : await prisma.customerVehicle.create({
            data: {
              shop,
              customerId: String(customer.id),
              customerEmail: customer.email,
              customerPhone: customer.phone ?? null,
              customerName:
                [customer.first_name, customer.last_name]
                  .filter(Boolean)
                  .join(" ") || null,
              year: yearInt,
              make,
              model,
            },
          });

      // Schedule reminders for any line items that are tracked products
      const lineItems = order.line_items ?? [];
      const productGids = lineItems
        .filter((li) => li.product_id != null)
        .map((li) => `gid://shopify/Product/${li.product_id}`);

      if (productGids.length > 0) {
        const tracked = await prisma.trackedProduct.findMany({
          where: {
            shop,
            shopifyProductId: { in: productGids },
            isActive: true,
          },
        });

        const now = new Date();
        await prisma.reminder.createMany({
          data: tracked.map((tp) => ({
            shop,
            vehicleId: vehicle.id,
            customerId: String(customer.id),
            customerEmail: customer.email,
            customerPhone: customer.phone ?? null,
            productTitle: tp.productTitle,
            productCategory: tp.category,
            scheduledFor: new Date(now.getTime() + tp.intervalDays * 86_400_000),
            channel: "email", // reminder engine upgrades to SMS at send time if store has smsEnabled + customer has phone
          })),
          skipDuplicates: true,
        });
      }
      break;
    }

    case "CUSTOMERS_DATA_REQUEST": {
      // Shopify GDPR: merchant or customer requested their data.
      // We acknowledge receipt. RevRemind stores: CustomerVehicle + Reminder rows.
      // No external export endpoint required for apps that store data only within
      // their own database and Railway/Supabase — acknowledging with 200 is sufficient.
      const dataReq = payload as CustomersDataRequestPayload;
      console.log(
        `[GDPR] Data request for customer ${dataReq.customer.id} on shop ${shop}`
      );
      break;
    }

    case "CUSTOMERS_REDACT": {
      // Shopify GDPR: delete all data for this customer.
      const redact = payload as CustomersRedactPayload;
      const customerId = String(redact.customer.id);

      // Delete reminders first (FK references vehicleId)
      await prisma.reminder.deleteMany({ where: { shop, customerId } });
      // Delete vehicle profiles
      await prisma.customerVehicle.deleteMany({ where: { shop, customerId } });

      console.log(
        `[GDPR] Redacted customer ${customerId} data for shop ${shop}`
      );
      break;
    }

    case "SHOP_REDACT": {
      // Shopify GDPR: store has been uninstalled for 48+ hours — delete all shop data.
      const shopRedact = payload as ShopRedactPayload;
      const shopDomain = shopRedact.shop_domain;

      await prisma.reminder.deleteMany({ where: { shop: shopDomain } });
      await prisma.customerVehicle.deleteMany({ where: { shop: shopDomain } });
      await prisma.trackedProduct.deleteMany({ where: { shop: shopDomain } });
      await prisma.store.deleteMany({ where: { shop: shopDomain } });

      console.log(`[GDPR] Full redact complete for shop ${shopDomain}`);
      break;
    }

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
