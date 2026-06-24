import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
} from "@shopify/polaris";
import { authenticate, PLAN_PRO } from "../shopify.server";

// RevRemind uses Shopify Managed Pricing: merchants choose, start the free
// trial, and manage/cancel their plan on Shopify's hosted pricing page. The app
// only reads subscription status; it does NOT call the Billing API directly
// (managed pricing and billing.request are mutually exclusive).
const APP_HANDLE = "revremind";

// Shopify only allows test charges on development stores; partnerDevelopment
// tells us which kind of store this is so billing.check matches the right
// (test vs live) subscription.
async function resolveIsTest(admin: any): Promise<boolean> {
  if (process.env.BILLING_TEST === "true") return true;
  try {
    const resp = await admin.graphql(
      `#graphql
      query { shop { plan { partnerDevelopment } } }`
    );
    const body = await resp.json();
    return Boolean(body?.data?.shop?.plan?.partnerDevelopment);
  } catch {
    return false;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, admin, session } = await authenticate.admin(request);
  const storeHandle = session.shop.replace(/\.myshopify\.com$/, "");
  const managedPricingUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${APP_HANDLE}/pricing_plans`;

  let hasActivePayment = false;
  try {
    const isTest = await resolveIsTest(admin);
    const res = await billing.check({ plans: [PLAN_PRO], isTest });
    hasActivePayment = res.hasActivePayment;
  } catch (e) {
    // If the status check fails, show the default (no active plan) state — the
    // merchant can always see their real status on Shopify's pricing page.
    console.error("[billing] billing.check() failed:", e);
  }

  return json({ hasActivePayment, managedPricingUrl });
};

export default function BillingPage() {
  const { hasActivePayment, managedPricingUrl } = useLoaderData<typeof loader>();

  // Open Shopify's hosted pricing page at the top level (it cannot load inside
  // the embedded admin iframe).
  const goToPlans = () => {
    window.open(managedPricingUrl, "_top");
  };

  return (
    <Page title="Billing" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2">RevRemind</Text>
                    <Text variant="headingXl" as="p">
                      $24<Text as="span" variant="bodyMd" tone="subdued"> / month</Text>
                    </Text>
                  </BlockStack>
                  {hasActivePayment
                    ? <Badge tone="success">Active</Badge>
                    : <Badge>14-day free trial</Badge>}
                </InlineStack>

                <Divider />

                <BlockStack gap="200">
                  <Text variant="bodySm" as="p">Everything included:</Text>
                  <Text variant="bodySm" as="p">Vehicle year/make/model capture at checkout</Text>
                  <Text variant="bodySm" as="p">Automated maintenance reminder emails</Text>
                  <Text variant="bodySm" as="p">SMS reminders for customers who provided a phone number</Text>
                  <Text variant="bodySm" as="p">AI-personalized message content</Text>
                  <Text variant="bodySm" as="p">Unlimited vehicle profiles</Text>
                  <Text variant="bodySm" as="p">Full merchant dashboard</Text>
                  <Text variant="bodySm" as="p">14-day free trial</Text>
                </BlockStack>

                {hasActivePayment ? (
                  <Button onClick={goToPlans}>Manage plan</Button>
                ) : (
                  <Button variant="primary" onClick={goToPlans}>Start free trial</Button>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">What you get</Text>
              <BlockStack gap="100">
                <Text variant="bodySm" as="p">Email reminders</Text>
                <Text variant="bodySm" as="p">SMS reminders</Text>
                <Text variant="bodySm" as="p">AI-personalized messages</Text>
                <Text variant="bodySm" as="p">Vehicle capture at checkout</Text>
                <Text variant="bodySm" as="p">Full dashboard</Text>
                <Text variant="bodySm" as="p">14-day free trial, cancel anytime</Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
