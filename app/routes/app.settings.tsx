import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, useSubmit } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
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
import { authenticate } from "../shopify.server";
import { prisma } from "../shopify.server";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  const store = await prisma.store.findUnique({ where: { shop } });

  // Check env vars server-side — only pass booleans, never expose the values
  const envStatus = {
    sendgrid: !!process.env.SENDGRID_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    cronSecret: !!process.env.CRON_SECRET,
    twilioSid: !!process.env.TWILIO_ACCOUNT_SID,
    twilioToken: !!process.env.TWILIO_AUTH_TOKEN,
    twilioPhone: !!process.env.TWILIO_PHONE_NUMBER,
  };

  return json({
    shop,
    senderName: store?.senderName ?? "",
    senderEmail: store?.senderEmail ?? "",
    smsEnabled: store?.smsEnabled ?? false,
    envStatus,
  });
};

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  const formData = await request.formData();
  // Store blank fields as null (not ""), so the reminder engine's default-sender
  // fallback fires correctly. An empty-string sender makes SendGrid reject sends.
  const senderName = ((formData.get("senderName") as string) ?? "").trim() || null;
  const senderEmail = ((formData.get("senderEmail") as string) ?? "").trim() || null;
  const smsEnabled = formData.get("smsEnabled") === "true";

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (senderEmail && !emailRegex.test(senderEmail)) {
    return json({ success: false, error: "Sender email is not a valid email address." });
  }

  await prisma.store.upsert({
    where: { shop },
    create: {
      shop,
      accessToken: session.accessToken,
      senderName,
      senderEmail,
      smsEnabled,
    },
    update: { senderName, senderEmail, smsEnabled },
  });

  return json({ success: true, error: null });
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { senderName: initialName, senderEmail: initialEmail, smsEnabled: initialSms, envStatus } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSaving = navigation.state === "submitting";

  const [senderName, setSenderName] = useState(initialName);
  const [senderEmail, setSenderEmail] = useState(initialEmail);
  const [smsEnabled, setSmsEnabled] = useState(initialSms);
  const [bannerVisible, setBannerVisible] = useState(false);

  // Show the save-result banner whenever a new actionData arrives, then let user dismiss it
  useEffect(() => {
    if (actionData) setBannerVisible(true);
  }, [actionData]);

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
            {bannerVisible && actionData?.success && (
              <Banner tone="success" onDismiss={() => setBannerVisible(false)}>
                <p>Settings saved.</p>
              </Banner>
            )}
            {bannerVisible && actionData?.error && (
              <Banner tone="critical" onDismiss={() => setBannerVisible(false)}>
                <p>{actionData.error}</p>
              </Banner>
            )}

            {/* Sender identity */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Sender Identity</Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Reminder emails are sent from RevRemind's verified address (reminders@rev-remind.com) so they always deliver. Set your business name below to brand them, and add a reply-to address so customer replies reach you.
                </Text>
                <TextField
                  label="Sender name"
                  value={senderName}
                  onChange={setSenderName}
                  autoComplete="name"
                  helpText="The business name customers see on reminder emails. Leave blank to use the default."
                />
                <TextField
                  label="Reply-to email"
                  value={senderEmail}
                  onChange={setSenderEmail}
                  type="email"
                  autoComplete="email"
                  helpText="Where customer replies are sent. Leave blank to use the default. Emails are always sent from reminders@rev-remind.com."
                />
              </BlockStack>
            </Card>

            <Divider />

            {/* Reminder channels */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Reminder Channels</Text>
                  {smsEnabled ? (
                    <Badge tone="success">SMS Active</Badge>
                  ) : (
                    <Badge>Email Only</Badge>
                  )}
                </InlineStack>
                <Text variant="bodySm" as="p" tone="subdued">
                  Email reminders are always on. Enable SMS to also send text reminders to customers who provided a phone number at checkout.
                </Text>
                <Select
                  label="Delivery method"
                  options={smsOptions}
                  value={String(smsEnabled)}
                  onChange={(val) => setSmsEnabled(val === "true")}
                />
                {smsEnabled && !(envStatus.twilioSid && envStatus.twilioToken && envStatus.twilioPhone) && (
                  <Banner tone="warning">
                    <p>
                      SMS is enabled but not yet fully configured. Reminders will fall back to email until setup is complete. Contact support if you need help.
                    </p>
                  </Banner>
                )}
              </BlockStack>
            </Card>

            <Divider />

            {/* Cron status (informational) */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Reminder Schedule</Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  RevRemind automatically checks for due reminders once per day and sends them on your behalf. No manual action is needed. Reminders go out at the right time based on each product's maintenance interval.
                </Text>
              </BlockStack>
            </Card>

          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Service Status</Text>
                <BlockStack gap="100">
                  <EnvVar name="Email delivery" status={envStatus.sendgrid ? "set" : "pending"} />
                  <EnvVar name="AI personalization" status={envStatus.anthropic ? "set" : "pending"} />
                  <EnvVar name="Scheduled reminders" status={envStatus.cronSecret ? "set" : "pending"} />
                  <EnvVar
                    name="SMS delivery"
                    status={
                      envStatus.twilioSid && envStatus.twilioToken && envStatus.twilioPhone
                        ? "set"
                        : smsEnabled
                        ? "pending"
                        : "optional"
                    }
                  />
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
