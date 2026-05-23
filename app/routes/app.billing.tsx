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
import { authenticate, PLAN_STARTER, PLAN_PRO } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PLAN_STARTER, PLAN_PRO],
    isTest: process.env.NODE_ENV !== "production",
  });

  const activePlan = appSubscriptions[0]?.name ?? null;

  return json({ hasActivePayment, activePlan, subscription: appSubscriptions[0] ?? null });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const baseUrl = process.env.SHOPIFY_APP_URL ?? "https://revremind-production.up.railway.app";

  if (intent === "subscribe_starter") {
    await billing.request({
      plan: PLAN_STARTER,
      isTest: process.env.NODE_ENV !== "production",
      returnUrl: `${baseUrl}/app/billing`,
    });
  }

  if (intent === "subscribe_pro") {
    await billing.request({
      plan: PLAN_PRO,
      isTest: process.env.NODE_ENV !== "production",
      returnUrl: `${baseUrl}/app/billing`,
    });
  }

  if (intent === "cancel") {
    const { appSubscriptions } = await billing.check({
      plans: [PLAN_STARTER, PLAN_PRO],
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
  const { hasActivePayment, activePlan, subscription } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const isStarter = activePlan === PLAN_STARTER;
  const isPro = activePlan === PLAN_PRO;

  const handleSubscribe = (plan: "starter" | "pro") => {
    submit({ intent: `subscribe_${plan}` }, { method: "post" });
  };

  const handleCancel = () => {
    if (confirm("Cancel your RevRemind subscription? You will lose access immediately.")) {
      submit({ intent: "cancel" }, { method: "post" });
    }
  };

  const handleUpgrade = () => {
    submit({ intent: "subscribe_pro" }, { method: "post" });
  };

  return (
    <Page title="Billing" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">

            {/* Active subscription banner */}
            {hasActivePayment && (
              <Banner tone="success">
                <p>
                  You are on the <strong>{activePlan}</strong> plan.
                  {isStarter && " Upgrade to Pro to unlock SMS reminders."}
                </p>
              </Banner>
            )}

            {/* Starter Plan Card */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2">Starter</Text>
                    <Text variant="headingXl" as="p">$29<Text as="span" variant="bodyMd" tone="subdued"> / month</Text></Text>
                  </BlockStack>
                  {isStarter ? (
                    <Badge tone="success">Current Plan</Badge>
                  ) : (
                    <Badge>Email Only</Badge>
                  )}
                </InlineStack>

                <Divider />

                <BlockStack gap="200">
                  <Text variant="bodySm" as="p">Everything you need to get started:</Text>
                  <Text variant="bodySm" as="p">Vehicle year/make/model capture at checkout</Text>
                  <Text variant="bodySm" as="p">Automated maintenance reminder emails</Text>
                  <Text variant="bodySm" as="p">AI-personalized message content</Text>
                  <Text variant="bodySm" as="p">Unlimited vehicle profiles</Text>
                  <Text variant="bodySm" as="p">Full merchant dashboard</Text>
                  <Text variant="bodySm" as="p">14-day free trial</Text>
                </BlockStack>

                {!hasActivePayment && (
                  <Button variant="primary" onClick={() => handleSubscribe("starter")}>
                    Start Free Trial — Starter
                  </Button>
                )}
                {isStarter && (
                  <Box paddingBlockStart="200">
                    <Button tone="critical" onClick={handleCancel}>Cancel Subscription</Button>
                  </Box>
                )}
              </BlockStack>
            </Card>

            {/* Pro Plan Card */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <InlineStack gap="200" blockAlign="center">
                      <Text variant="headingMd" as="h2">Pro</Text>
                      <Badge tone="info">Most Popular</Badge>
                    </InlineStack>
                    <Text variant="headingXl" as="p">$49<Text as="span" variant="bodyMd" tone="subdued"> / month</Text></Text>
                  </BlockStack>
                  {isPro && <Badge tone="success">Current Plan</Badge>}
                </InlineStack>

                <Divider />

                <BlockStack gap="200">
                  <Text variant="bodySm" as="p">Everything in Starter, plus:</Text>
                  <Text variant="bodySm" as="p">SMS reminders (in addition to email)</Text>
                  <Text variant="bodySm" as="p">Customers who provided a phone number get texts</Text>
                  <Text variant="bodySm" as="p">Higher open rates vs email alone</Text>
                  <Text variant="bodySm" as="p">14-day free trial</Text>
                </BlockStack>

                {!hasActivePayment && (
                  <Button variant="primary" onClick={() => handleSubscribe("pro")}>
                    Start Free Trial — Pro
                  </Button>
                )}
                {isStarter && (
                  <Button variant="primary" onClick={handleUpgrade}>
                    Upgrade to Pro
                  </Button>
                )}
                {isPro && (
                  <Box paddingBlockStart="200">
                    <Button tone="critical" onClick={handleCancel}>Cancel Subscription</Button>
                  </Box>
                )}
              </BlockStack>
            </Card>

            {subscription && (
              <Text variant="bodySm" as="p" tone="subdued">
                Subscription ID: {subscription.id}
              </Text>
            )}

          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Plan Comparison</Text>
              <BlockStack gap="100">
                <Text variant="bodySm" as="p" fontWeight="bold">Starter — $29/mo</Text>
                <Text variant="bodySm" as="p">Email reminders</Text>
                <Text variant="bodySm" as="p">AI-personalized messages</Text>
                <Text variant="bodySm" as="p">Vehicle capture at checkout</Text>
                <Text variant="bodySm" as="p">Full dashboard</Text>
                <Divider />
                <Text variant="bodySm" as="p" fontWeight="bold">Pro — $49/mo</Text>
                <Text variant="bodySm" as="p">Everything in Starter</Text>
                <Text variant="bodySm" as="p">+ SMS reminders</Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
