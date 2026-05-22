import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Box,
  Banner,
} from "@shopify/polaris";
import { authenticate, prisma } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [vehicleCount, pendingReminders, sentThisMonth, store] =
    await Promise.all([
      prisma.customerVehicle.count({ where: { shop } }),
      prisma.reminder.count({ where: { shop, status: "PENDING" } }),
      prisma.reminder.count({
        where: {
          shop,
          status: "SENT",
          sentAt: { gte: new Date(new Date().setDate(1)) },
        },
      }),
      prisma.store.findUnique({ where: { shop } }),
    ]);

  return json({ vehicleCount, pendingReminders, sentThisMonth, store });
};

export default function Dashboard() {
  const { vehicleCount, pendingReminders, sentThisMonth, store } =
    useLoaderData<typeof loader>();

  const isNewStore = vehicleCount === 0;

  return (
    <Page title="RevRemind Dashboard">
      <BlockStack gap="500">
        {isNewStore && (
          <Banner title="Welcome to RevRemind" tone="info">
            <p>
              RevRemind automatically sends maintenance reminders to your
              customers based on their vehicle and what they purchased. Get
              started by going to Products to categorize your catalog.
            </p>
          </Banner>
        )}

        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Vehicle Profiles
              </Text>
              <Text as="p" variant="headingXl">
                {vehicleCount}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Customers registered
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Pending Reminders
              </Text>
              <Text as="p" variant="headingXl">
                {pendingReminders}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Scheduled to send
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Sent This Month
              </Text>
              <Text as="p" variant="headingXl">
                {sentThisMonth}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Reminders delivered
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  How RevRemind Works
                </Text>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    1. Customers register their vehicle (year/make/model) at
                    checkout
                  </Text>
                  <Text as="p" variant="bodyMd">
                    2. RevRemind maps their purchase to a maintenance interval
                  </Text>
                  <Text as="p" variant="bodyMd">
                    3. Automated reminders go out at the right time — oil
                    filters at 90 days, brake pads at 12 months, etc.
                  </Text>
                  <Text as="p" variant="bodyMd">
                    4. Customers come back and buy again
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Quick Actions
                </Text>
                <BlockStack gap="200">
                  <Box>
                    <Text as="p" variant="bodyMd">
                      <a href="/app/products">Categorize your products</a>
                    </Text>
                  </Box>
                  <Box>
                    <Text as="p" variant="bodyMd">
                      <a href="/app/settings">Configure reminders</a>
                    </Text>
                  </Box>
                  <Box>
                    <Text as="p" variant="bodyMd">
                      <a href="/app/vehicles">View customer vehicles</a>
                    </Text>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
