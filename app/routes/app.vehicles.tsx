import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  DataTable,
  Badge,
  EmptyState,
} from "@shopify/polaris";
import { authenticate, prisma } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const vehicles = await prisma.customerVehicle.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reminders: {
        where: { status: "PENDING" },
        orderBy: { scheduledFor: "asc" },
        take: 1,
      },
    },
  });

  return json({ vehicles });
};

export default function Vehicles() {
  const { vehicles } = useLoaderData<typeof loader>();

  if (vehicles.length === 0) {
    return (
      <Page title="Customer Vehicles">
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="No vehicles registered yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  When customers check out and register their vehicle, they will
                  appear here. Make sure your checkout extension is active.
                </p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const rows = vehicles.map((v) => {
    const nextReminder = v.reminders[0];
    return [
      v.customerName || v.customerEmail,
      `${v.year} ${v.make} ${v.model}${v.trim ? " " + v.trim : ""}`,
      new Date(v.createdAt).toLocaleDateString(),
      nextReminder ? (
        <Badge tone="attention">
          {new Date(nextReminder.scheduledFor).toLocaleDateString()}
        </Badge>
      ) : (
        <Badge tone="success">Up to date</Badge>
      ),
    ];
  });

  return (
    <Page title="Customer Vehicles">
      <BlockStack gap="500">
        <Text as="p" variant="bodyMd" tone="subdued">
          {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} registered
        </Text>
        <Layout>
          <Layout.Section>
            <Card>
              <DataTable
                columnContentTypes={["text", "text", "text", "text"]}
                headings={["Customer", "Vehicle", "Registered", "Next Reminder"]}
                rows={rows}
              />
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
