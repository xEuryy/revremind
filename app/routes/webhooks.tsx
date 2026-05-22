import { authenticate, prisma } from "../shopify.server";
import type { ActionFunctionArgs } from "@remix-run/node";

type NoteAttribute = { name: string; value: string };
type LineItem = { product_id: number | null; title: string };
type OrderPayload = {
  id: number;
  customer?: {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  note_attributes?: NoteAttribute[];
  line_items?: LineItem[];
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
            productTitle: tp.productTitle,
            productCategory: tp.category,
            scheduledFor: new Date(now.getTime() + tp.intervalDays * 86_400_000),
            channel: "email",
          })),
          skipDuplicates: true,
        });
      }
      break;
    }

    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
