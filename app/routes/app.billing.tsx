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
  Divider,
} from "@shopify/polaris";
import { authenticate, PLAN_PRO } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const isTestBilling = process.env.BILLING_TEST === "true" || process.env.NODE_ENV !== "production";

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PLAN_PRO],
    isTest: isTestBilling,
  });

  return json({
    hasActivePayment,
    subscriptionId: appSubscriptions[0]?.id ?? null,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const baseUrl = process.env.SHOPIFY_APP_URL ?? "https://revremind-production.up.railway.app";
  const isTestBilling = process.env.BILLING_TEST === "true" || process.env.NODE_ENV !== "production";

  if (intent === "subscribe") {
    await billing.request({
      plan: PLAN_PRO,
      isTest: isTestBilling,
      returnUrl: `${baseUrl}/app/billing`,
    });
  }

  if (intent === "cancel") {
    const { appSubscriptions } = await billing.check({
      plans: [PLAN_PRO],
      isTest: isTestBilling,
    });
    if (appSubscriptions[0]) {
      await billing.cancel({
        subscriptionId: appSubscriptions[0].id,
        isTest: isTestBilling,
        prorate: true,
      });
    }
  }

  return json({ ok: true });
};

export default function BillingPage() {
  const { hasActivePayment, subscriptionId } = useLoaderData<typeof loader>();
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
    <Page title="Billing" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">

            {hasActivePayment && (
              <Banner tone="success">
                <p>Your RevRemind subscription is active.</p>
              </Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2">RevRemind</Text>
                    <Text variant="headingXl" as="p">
                      $49<Text as="span" variant="bodyMd" tone="subdued"> / month</Text>
                    </Text>
                  </BlockStack>
                  {hasActivePayment
                    ? <Badge tone="success">Active</Badge>
                    : <Badge>14-day free trial</Badge>
                  }
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

                {!hasActivePayment && (
                  <Button variant="primary" onClick={handleSubscribe}>
                    Start Free Trial
                  </Button>
                )}

                {hasActivePayment && (
                  <Box paddingBlockStart="200">
                    <Button tone="critical" onClick={handleCancel}>
                      Cancel Subscription
                    </Button>
                  </Box>
                )}
              </BlockStack>
            </Card>

            {subscriptionId && (
              <Text variant="bodySm" as="p" tone="subdued">
                Subscription ID: {subscriptionId}
              </Text>
            )}

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
