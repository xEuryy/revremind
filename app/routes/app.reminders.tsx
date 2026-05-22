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
  Tabs,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate, prisma } from "../shopify.server";

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

function reminderRows(reminders: any[]) {
  return reminders.map((r) => [
    r.customerEmail,
    r.productTitle,
    r.productCategory.replace(/_/g, " "),
    r.channel.toUpperCase(),
    new Date(r.scheduledFor).toLocaleDateString(),
  ]);
}

export default function Reminders() {
  const { pending, sent, failed } = useLoaderData<typeof loader>();
  const [selected, setSelected] = useState(0);

  const tabs = [
    { id: "pending", content: `Pending (${pending.length})` },
    { id: "sent", content: `Sent (${sent.length})` },
    { id: "failed", content: `Failed (${failed.length})` },
  ];

  const headings = ["Customer", "Product", "Category", "Channel", "Scheduled"];

  return (
    <Page title="Reminders">
      <Layout>
        <Layout.Section>
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
        </Layout.Section>
      </Layout>
    </Page>
  );
}
