import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useEffect } from "react";
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
  const isTestBilling =
    process.env.BILLING_TEST === "true" ||
    process.env.NODE_ENV !== "production";

  try {
    const { hasActivePayment, appSubscriptions } = await billing.check({
      plans: [PLAN_PRO],
      isTest: isTestBilling,
    });

    return json({
      hasActivePayment,
      subscriptionId: appSubscriptions[0]?.id ?? null,
      billingError: false,
    });
  } catch (e) {
    // Billing API unavailable — show page in default state
    console.error("[billing] billing.check() failed:", e);
    return json({ hasActivePayment: false, subscriptionId: null, billingError: false });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const baseUrl = process.env.SHOPIFY_APP_URL ?? "https://revremind-production.up.railway.app";
  const isTestBilling = process.env.BILLING_TEST === "true" || process.env.NODE_ENV !== "production";

  if (intent === "subscribe") {
    try {
      await billing.request({
        plan: PLAN_PRO,
        isTest: isTestBilling,
        returnUrl: `${baseUrl}/app/billing`,
      });
    } catch (e) {
      // billing.request throws a redirect Response whose Location is Shopify's
      // charge-approval URL. Inside the embedded admin iframe that page cannot
      // load (it refuses framing), so following the redirect here does nothing.
      // Hand the URL back to the client to open at the top level instead.
      if (e instanceof Response) {
        const confirmationUrl = e.headers.get("Location");
        if (confirmationUrl) return json({ confirmationUrl });
        throw e;
      }
      console.error("[billing] billing.request() failed:", e);
      return json({ ok: false, error: "Could not start the subscription. Please try again." });
    }
  }

  if (intent === "cancel") {
    try {
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
    } catch (e) {
      console.error("[billing] cancel failed:", e);
    }
  }

  return json({ ok: true });
};

export default function BillingPage() {
  const { hasActivePayment, subscriptionId, billingError } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isWorking = fetcher.state !== "idle";

  useEffect(() => {
    const url = (fetcher.data as any)?.confirmationUrl;
    if (url) {
      // Break out of the embedded admin iframe to Shopify's charge approval page.
      window.open(url, "_top");
    }
  }, [fetcher.data]);

  const handleSubscribe = () => {
    fetcher.submit({ intent: "subscribe" }, { method: "post" });
  };

  const handleCancel = () => {
    if (confirm("Cancel your RevRemind subscription? You will lose access immediately.")) {
      fetcher.submit({ intent: "cancel" }, { method: "post" });
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
                  <Button variant="primary" onClick={handleSubscribe} loading={isWorking}>
                    Start Free Trial
                  </Button>
                )}

                {(fetcher.data as any)?.error && (
                  <Banner tone="critical">
                    <p>{(fetcher.data as any).error}</p>
                  </Banner>
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
