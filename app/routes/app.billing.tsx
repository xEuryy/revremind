import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  Box,
} from "@shopify/polaris";
import { authenticate, PLAN_MONTHLY } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PLAN_MONTHLY],
    isTest: process.env.NODE_ENV !== "production",
  });

  return json({
    hasActivePayment,
    subscription: appSubscriptions[0] ?? null,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "subscribe") {
    await billing.request({
      plan: PLAN_MONTHLY,
      isTest: process.env.NODE_ENV !== "production",
      returnUrl: "/app/billing",
    });
  }

  if (intent === "cancel") {
    const { appSubscriptions } = await billing.check({
      plans: [PLAN_MONTHLY],
      isTest: process.env.NODE_ENV !== "production",
    });
    if (appSubscriptions[0]) {
      await billing.cancel({
        subscriptionId: appSubscriptions[0].id,
        isTest: process.env.NODE_ENV !== "production",
        prorate: true,
      });
    }
  }

  return json({ ok: true });
};

export default function BillingPage() {
  const { hasActivePayment, subscription } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleSubscribe = () => {
    submit({ intent: "subscribe" }, { method: "post" });
  };

  const handleCancel = () => {
    if (confirm("Cancel your RevRemind subscription? You will lose access immediately.")) {
      submit({ intent: "cancel" }, { method: "post" });
    }
  };

  return (
    <Page
      title="Billing"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          {hasActivePayment ? (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2">RevRemind Monthly</Text>
                    <Text variant="bodyMd" as="p" tone="subdued">$49 / month</Text>
                  </BlockStack>
                  <Badge tone="success">Active</Badge>
                </InlineStack>

                {subscription && (
                  <BlockStack gap="100">
                    <Text variant="bodySm" as="p" tone="subdued">
                      Plan ID: {subscription.id}
                    </Text>
                  </BlockStack>
                )}

                <Box paddingBlockStart="200">
                  <Button tone="critical" onClick={handleCancel}>
                    Cancel Subscription
                  </Button>
                </Box>
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="400">
                <Banner tone="warning">
                  <p>You do not have an active subscription. Subscribe to activate RevRemind for your store.</p>
                </Banner>

                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">RevRemind Monthly</Text>
                  <Text variant="bodyMd" as="p">
                    $49 / month — 14-day free trial included. Cancel anytime.
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    Includes unlimited vehicle capture, automated email and SMS reminders, AI-personalized messages, and full merchant dashboard.
                  </Text>
                </BlockStack>

                <Button variant="primary" onClick={handleSubscribe}>
                  Start Free Trial
                </Button>
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">What is included</Text>
              <BlockStack gap="100">
                <Text variant="bodySm" as="p">Vehicle data capture at checkout</Text>
                <Text variant="bodySm" as="p">Automated maintenance reminders</Text>
                <Text variant="bodySm" as="p">Email + SMS delivery</Text>
                <Text variant="bodySm" as="p">AI-personalized message content</Text>
                <Text variant="bodySm" as="p">Full merchant dashboard</Text>
                <Text variant="bodySm" as="p">14-day free trial</Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
