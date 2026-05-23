import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, useSubmit } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  TextField,
  BlockStack,
  InlineStack,
  Button,
  Banner,
  Divider,
  Badge,
  Box,
  Select,
} from "@shopify/polaris";
import { authenticate, PLAN_STARTER, PLAN_PRO } from "../shopify.server";
import { prisma } from "../shopify.server";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const { shop } = session;

  const isTestBilling = process.env.BILLING_TEST === "true" || process.env.NODE_ENV !== "production";
  const { appSubscriptions } = await billing.check({
    plans: [PLAN_STARTER, PLAN_PRO],
    isTest: isTestBilling,
  });
  const activePlan = appSubscriptions[0]?.name ?? null;
  const isPro = activePlan === PLAN_PRO;

  const store = await prisma.store.findUnique({ where: { shop } });

  return json({
    shop,
    senderName: store?.senderName ?? "",
    senderEmail: store?.senderEmail ?? "",
    smsEnabled: store?.smsEnabled ?? false,
    isPro,
    activePlan,
  });
};

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const { shop } = session;

  const formData = await request.formData();
  const senderName = (formData.get("senderName") as string)?.trim() ?? "";
  const senderEmail = (formData.get("senderEmail") as string)?.trim() ?? "";
  const smsEnabledRaw = formData.get("smsEnabled") === "true";

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (senderEmail && !emailRegex.test(senderEmail)) {
    return json({ success: false, error: "Sender email is not a valid email address." });
  }

  // SMS is a Pro-only feature — enforce server-side even if client sends true
  let smsEnabled = smsEnabledRaw;
  if (smsEnabledRaw) {
    const isTestBilling = process.env.BILLING_TEST === "true" || process.env.NODE_ENV !== "production";
    const { appSubscriptions } = await billing.check({
      plans: [PLAN_STARTER, PLAN_PRO],
      isTest: isTestBilling,
    });
    const isPro = appSubscriptions[0]?.name === PLAN_PRO;
    if (!isPro) {
      smsEnabled = false;
    }
  }

  await prisma.store.update({
    where: { shop },
    data: { senderName, senderEmail, smsEnabled },
  });

  return json({ success: true, error: null });
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { senderName: initialName, senderEmail: initialEmail, smsEnabled: initialSms, isPro } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSaving = navigation.state === "submitting";

  const [senderName, setSenderName] = useState(initialName);
  const [senderEmail, setSenderEmail] = useState(initialEmail);
  // If merchant is on Starter, SMS is always off in the UI regardless of DB value
  const [smsEnabled, setSmsEnabled] = useState(isPro ? initialSms : false);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append("senderName", senderName);
    formData.append("senderEmail", senderEmail);
    formData.append("smsEnabled", String(smsEnabled));
    submit(formData, { method: "post" });
  }, [senderName, senderEmail, smsEnabled, submit]);

  const smsOptions = [
    { label: "Email only", value: "false" },
    { label: "Email + SMS", value: "true" },
  ];

  return (
    <Page
      title="Settings"
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">

            {/* Save result banner */}
            {actionData?.success && (
              <Banner tone="success" onDismiss={() => {}}>
                <p>Settings saved.</p>
              </Banner>
            )}
            {actionData?.error && (
              <Banner tone="critical" onDismiss={() => {}}>
                <p>{actionData.error}</p>
              </Banner>
            )}

            {/* Sender identity */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Sender Identity</Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  This is the name and email address your customers see on maintenance reminder emails. Use your store or business name.
                </Text>
                <TextField
                  label="Sender name"
                  value={senderName}
                  onChange={setSenderName}
                  placeholder="Mike's Auto Parts"
                  autoComplete="name"
                  helpText="Appears as the From name in emails and SMS sign-off."
                />
                <TextField
                  label="Sender email"
                  value={senderEmail}
                  onChange={setSenderEmail}
                  placeholder="reminders@yourdomain.com"
                  type="email"
                  autoComplete="email"
                  helpText="Must match a verified SendGrid sender. Leave blank to use the default."
                />
              </BlockStack>
            </Card>

            <Divider />

            {/* Reminder channels */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Reminder Channels</Text>
                  {isPro && smsEnabled ? (
                    <Badge tone="success">SMS Active</Badge>
                  ) : (
                    <Badge>Email Only</Badge>
                  )}
                </InlineStack>
                <Text variant="bodySm" as="p" tone="subdued">
                  Email reminders are always included. SMS reminders are available on the Pro plan.
                </Text>

                {!isPro ? (
                  <Banner tone="info">
                    <p>
                      SMS reminders are a <strong>Pro plan</strong> feature. Upgrade to Pro ($49/mo) to send text message reminders to customers who provided a phone number.{" "}
                      <a href="/app/billing">Upgrade now</a>
                    </p>
                  </Banner>
                ) : (
                  <>
                    <Select
                      label="Delivery method"
                      options={smsOptions}
                      value={String(smsEnabled)}
                      onChange={(val) => setSmsEnabled(val === "true")}
                    />
                    {smsEnabled && (
                      <Banner tone="warning">
                        <p>
                          SMS requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER set in your Railway environment variables. Reminders will fall back to email if these are missing.
                        </p>
                      </Banner>
                    )}
                  </>
                )}
              </BlockStack>
            </Card>

            <Divider />

            {/* Cron status (informational) */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Reminder Schedule</Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Reminders run once daily via an automated cron job. The cron endpoint is secured with a token and must be triggered by your Railway scheduler.
                </Text>
                <Box
                  background="bg-surface-secondary"
                  padding="300"
                  borderRadius="200"
                >
                  <BlockStack gap="100">
                    <Text variant="bodySm" as="p" tone="subdued">Cron endpoint</Text>
                    <Text variant="bodyMd" as="p" fontWeight="medium">
                      POST /api/cron
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Header: Authorization: Bearer $CRON_SECRET
                    </Text>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>

          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Required env vars</Text>
                <BlockStack gap="100">
                  <EnvVar name="SENDGRID_API_KEY" status="pending" />
                  <EnvVar name="TWILIO_ACCOUNT_SID" status={smsEnabled ? "pending" : "optional"} />
                  <EnvVar name="TWILIO_AUTH_TOKEN" status={smsEnabled ? "pending" : "optional"} />
                  <EnvVar name="TWILIO_PHONE_NUMBER" status={smsEnabled ? "pending" : "optional"} />
                  <EnvVar name="ANTHROPIC_API_KEY" status="pending" />
                  <EnvVar name="CRON_SECRET" status="pending" />
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">How reminders work</Text>
                <Text variant="bodySm" as="p">
                  1. Customer buys a tracked product and enters their vehicle at checkout.
                </Text>
                <Text variant="bodySm" as="p">
                  2. RevRemind schedules a reminder based on the product category interval.
                </Text>
                <Text variant="bodySm" as="p">
                  3. Daily cron finds due reminders and sends email (and SMS if enabled).
                </Text>
                <Text variant="bodySm" as="p">
                  4. Message content is personalized by Claude AI using the vehicle and product data.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// Small helper to show env var status chips
function EnvVar({ name, status }: { name: string; status: "set" | "pending" | "optional" }) {
  const toneMap = { set: "success", pending: "warning", optional: "new" } as const;
  const labelMap = { set: "Set", pending: "Not set", optional: "Optional" };

  return (
    <InlineStack align="space-between" blockAlign="center">
      <Text variant="bodySm" as="span" fontWeight="medium">{name}</Text>
      <Badge tone={toneMap[status]}>{labelMap[status]}</Badge>
    </InlineStack>
  );
}
