import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  DataTable,
  Badge,
  Tabs,
  Button,
  Banner,
  InlineStack,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { authenticate, prisma } from "../shopify.server";
import { processPendingRemindersForShop } from "../lib/reminder-engine.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [pending, sent, failed] = await Promise.all([
    prisma.reminder.findMany({
      where: { shop, status: "PENDING" },
      orderBy: { scheduledFor: "asc" },
      take: 50,
    }),
    prisma.reminder.findMany({
      where: { shop, status: "SENT" },
      orderBy: { sentAt: "desc" },
      take: 50,
    }),
    prisma.reminder.findMany({
      where: { shop, status: "FAILED" },
      orderBy: { scheduledFor: "desc" },
      take: 50,
    }),
  ]);

  return json({ pending, sent, failed });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const result = await processPendingRemindersForShop(shop);
    return json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      error: result.firstError,
    });
  } catch (err: any) {
    console.error("[reminders] run_now failed:", err);
    return json({ ok: false, sent: 0, failed: 0, error: err.message ?? "Unknown error" });
  }
};

function reminderRows(reminders: any[]) {
  return reminders.map((r) => [
    r.customerEmail ?? "—",
    r.productTitle ?? "—",
    (r.productCategory ?? "").replace(/_/g, " "),
    (r.channel ?? "email").toUpperCase(),
    r.scheduledFor ? new Date(r.scheduledFor).toLocaleDateString() : "—",
  ]);
}

export default function Reminders() {
  const { pending, sent, failed } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [selected, setSelected] = useState(0);
  const [bannerVisible, setBannerVisible] = useState(false);

  const isRunning = fetcher.state === "submitting";

  useEffect(() => {
    if (fetcher.data) {
      setBannerVisible(true);
      // Jump to the tab that shows the result: Sent if any went out, else Failed.
      if (fetcher.data.sent > 0) {
        setSelected(1);
      } else if (fetcher.data.failed && fetcher.data.failed > 0) {
        setSelected(2);
      }
    }
  }, [fetcher.data]);

  const tabs = [
    { id: "pending", content: `Pending (${pending.length})` },
    { id: "sent", content: `Sent (${sent.length})` },
    { id: "failed", content: `Failed (${failed.length})` },
  ];

  const headings = ["Customer", "Product", "Category", "Channel", "Scheduled"];

  return (
    <Page
      title="Reminders"
      primaryAction={
        pending.length > 0
          ? {
              content: "Send pending reminders now",
              loading: isRunning,
              onAction: () => fetcher.submit({}, { method: "POST" }),
            }
          : undefined
      }
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">

            {bannerVisible && fetcher.data?.ok && fetcher.data.sent > 0 && (
              <Banner
                tone="success"
                onDismiss={() => setBannerVisible(false)}
              >
                <p>
                  {fetcher.data.sent} reminder{fetcher.data.sent !== 1 ? "s" : ""} sent successfully
                  {fetcher.data.failed && fetcher.data.failed > 0
                    ? `. ${fetcher.data.failed} could not be sent: ${fetcher.data.error}`
                    : "."}
                </p>
              </Banner>
            )}

            {bannerVisible && fetcher.data?.ok && fetcher.data.sent === 0 && fetcher.data.failed === 0 && (
              <Banner
                tone="info"
                onDismiss={() => setBannerVisible(false)}
              >
                <p>No pending reminders to send.</p>
              </Banner>
            )}

            {bannerVisible && fetcher.data && (!fetcher.data.ok || (fetcher.data.sent === 0 && fetcher.data.failed > 0)) && (
              <Banner
                tone="critical"
                onDismiss={() => setBannerVisible(false)}
              >
                <p>Could not send reminders: {fetcher.data.error ?? "Unknown error"}</p>
              </Banner>
            )}

            <Card>
              <Tabs tabs={tabs} selected={selected} onSelect={setSelected}>
                <BlockStack gap="400">
                  {selected === 0 && (
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text", "text"]}
                      headings={headings}
                      rows={reminderRows(pending)}
                      emptyState={
                        <Text as="p" variant="bodyMd" tone="subdued">
                          No pending reminders. They will appear here once customers
                          register vehicles and make purchases.
                        </Text>
                      }
                    />
                  )}
                  {selected === 1 && (
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text", "text"]}
                      headings={headings}
                      rows={reminderRows(sent)}
                      emptyState={
                        <Text as="p" variant="bodyMd" tone="subdued">
                          No reminders sent yet.
                        </Text>
                      }
                    />
                  )}
                  {selected === 2 && (
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text", "text"]}
                      headings={headings}
                      rows={reminderRows(failed)}
                      emptyState={
                        <Text as="p" variant="bodyMd" tone="subdued">
                          No failed reminders.
                        </Text>
                      }
                    />
                  )}
                </BlockStack>
              </Tabs>
            </Card>

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
