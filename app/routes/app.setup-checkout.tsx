import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { Page, Card, Text, BlockStack, Button, Banner } from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const editorUrl = `https://${session.shop}/admin/settings/checkout`;

  return json({ editorUrl });
};

export default function SetupCheckout() {
  const { editorUrl } = useLoaderData<typeof loader>();

  const openEditor = () => {
    if (window.top) {
      window.top.location.href = editorUrl;
    } else {
      window.open(editorUrl, "_blank");
    }
  };

  return (
    <Page title="Checkout Extension Setup">
      <BlockStack gap="400">
        <Banner title="One-time setup" tone="info">
          <p>
            The Vehicle Capture extension needs to be added to your checkout
            layout once.
          </p>
        </Banner>
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Add Vehicle Capture to Checkout
            </Text>
            <Text as="p" variant="bodyMd">
              1. Click the button below to open Checkout Settings.
            </Text>
            <Text as="p" variant="bodyMd">
              2. Click <strong>Customize</strong> on the checkout.
            </Text>
            <Text as="p" variant="bodyMd">
              3. In the editor left sidebar, find <strong>Vehicle Capture</strong> under Apps and click <strong>Add block</strong>.
            </Text>
            <Text as="p" variant="bodyMd">
              4. Click <strong>Save</strong>. Done.
            </Text>
            <Button onClick={openEditor} variant="primary" size="large">
              Open Checkout Settings
            </Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
