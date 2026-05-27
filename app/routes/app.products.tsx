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
  Select,
  Button,
  Banner,
  Badge,
  InlineStack,
  EmptyState,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate, prisma } from "../shopify.server";

// Maintenance categories with default intervals
const CATEGORIES = [
  { label: "Oil Filter", value: "oil_filter", days: 90 },
  { label: "Brake Pads", value: "brake_pads", days: 365 },
  { label: "Air Filter", value: "air_filter", days: 365 },
  { label: "Wiper Blades", value: "wiper_blades", days: 180 },
  { label: "Cabin Air Filter", value: "cabin_air_filter", days: 365 },
  { label: "Spark Plugs", value: "spark_plugs", days: 730 },
  { label: "Fuel Filter", value: "fuel_filter", days: 730 },
  { label: "Transmission Fluid", value: "transmission_fluid", days: 730 },
  { label: "Coolant / Antifreeze", value: "coolant", days: 730 },
  { label: "Battery", value: "battery", days: 1095 },
  { label: "Tires", value: "tires", days: 1825 },
  { label: "Car Care / Detailing", value: "detailing", days: 90 },
  { label: "Other Maintenance", value: "other", days: 180 },
  { label: "Not a maintenance item", value: "skip", days: 0 },
];

// Exchange Shopify session token (id_token JWT) for a fresh API access token
async function exchangeForFreshToken(request: Request, shop: string): Promise<string | null> {
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get("id_token");
  if (!sessionToken) return null;
  try {
    const resp = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: sessionToken,
        subject_token_type: "urn:shopify:params:oauth:token-type:session-token",
        requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error("[products] token exchange failed:", resp.status, err.slice(0, 200));
      return null;
    }
    const data = await resp.json();
    const newToken = data.access_token as string;
    console.log("[products] token exchange succeeded, new token prefix:", newToken?.slice(0, 12));
    return newToken;
  } catch (e: any) {
    console.error("[products] token exchange error:", e?.message);
    return null;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // Pull products from Shopify
  let shopifyProducts: { id: string; title: string; status: string }[] = [];
  let fetchError: string | null = null;
  try {
    // Try token exchange first (gets a fresh expiring token from the page's session JWT)
    const freshToken = await exchangeForFreshToken(request, shop);
    let data: any;

    if (freshToken) {
      // Use fresh token directly via REST-style GraphQL call
      const resp = await fetch(
        `https://${shop}/admin/api/2024-10/graphql.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": freshToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `{ products(first: 100) { edges { node { id title status } } } }`,
          }),
        }
      );
      data = await resp.json();
      // Persist the fresh token so the cron job and other routes benefit too
      if (!data?.errors && freshToken !== session.accessToken) {
        await prisma.session.update({
          where: { id: `offline_${shop}` },
          data: { accessToken: freshToken },
        }).catch(() => {});
        await prisma.store.update({
          where: { shop },
          data: { accessToken: freshToken },
        }).catch(() => {});
      }
    } else {
      // Fall back to SDK admin object
      const response = await admin.graphql(
        `{ products(first: 100) { edges { node { id title status } } } }`
      );
      data = await response.json();
    }

    if (data?.errors) {
      fetchError = JSON.stringify(data.errors);
      console.error("[products] GraphQL errors:", fetchError);
    }
    shopifyProducts = (data?.data?.products?.edges ?? []).map((e: any) => e.node);
  } catch (e: any) {
    if (e && typeof e === "object" && "status" in e && "headers" in e) throw e;
    fetchError = e?.message ?? String(e);
    console.error("[products] GraphQL fetch failed:", fetchError);
  }

  // Get already-categorized products
  const tracked = await prisma.trackedProduct.findMany({ where: { shop } });
  const trackedMap = Object.fromEntries(
    tracked.map((p) => [p.shopifyProductId, p])
  );

  return json({ shopifyProducts, trackedMap, fetchError });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const productId = formData.get("productId") as string;
  const productTitle = formData.get("productTitle") as string;
  const category = formData.get("category") as string;

  if (category === "skip") {
    await prisma.trackedProduct.deleteMany({
      where: { shop, shopifyProductId: productId },
    });
    return json({ ok: true });
  }

  const cat = CATEGORIES.find((c) => c.value === category);
  if (!cat) return json({ error: "Invalid category" }, { status: 400 });

  await prisma.trackedProduct.upsert({
    where: { shop_shopifyProductId: { shop, shopifyProductId: productId } },
    create: {
      shop,
      shopifyProductId: productId,
      productTitle,
      category,
      intervalDays: cat.days,
    },
    update: { category, intervalDays: cat.days, productTitle },
  });

  return json({ ok: true });
};

export default function Products() {
  const { shopifyProducts, trackedMap, fetchError } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleCategoryChange = (
    productId: string,
    productTitle: string,
    category: string
  ) => {
    fetcher.submit(
      { productId, productTitle, category },
      { method: "POST" }
    );
  };

  const categorizedCount = Object.keys(trackedMap).length;

  const rows = shopifyProducts.map((product: any) => {
    const tracked = trackedMap[product.id];
    const currentCategory = tracked?.category || "";
    const cat = CATEGORIES.find((c) => c.value === currentCategory);

    return [
      product.title,
      <Select
        label=""
        labelHidden
        options={[
          { label: "Select category...", value: "" },
          ...CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
        ]}
        value={currentCategory}
        onChange={(val) => handleCategoryChange(product.id, product.title, val)}
      />,
      cat && currentCategory !== "skip" ? (
        <Badge tone="success">
          {cat.days < 365
            ? `${cat.days} days`
            : `${Math.round(cat.days / 365)} year${cat.days >= 730 ? "s" : ""}`}
        </Badge>
      ) : currentCategory === "skip" ? (
        <Badge tone="info">Skipped</Badge>
      ) : (
        <Badge tone="attention">Uncategorized</Badge>
      ),
    ];
  });

  if (shopifyProducts.length === 0) {
    return (
      <Page title="Product Categories">
        <Layout>
          {fetchError && (
            <Layout.Section>
              <Banner tone="critical" title="API error loading products">
                <p>{fetchError}</p>
              </Banner>
            </Layout.Section>
          )}
          <Layout.Section>
            <Card>
              <EmptyState
                heading="No products found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Add products to your Shopify store first, then come back here to
                  categorize them for maintenance reminders.
                </p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Product Categories">
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            Categorize each product so RevRemind knows when to send reminders.
            Oil filters get a 90-day reminder, brake pads get 12 months, etc.
          </p>
        </Banner>

        <InlineStack gap="400">
          <Text as="p" variant="bodyMd">
            {categorizedCount} of {shopifyProducts.length} products categorized
          </Text>
        </InlineStack>

        <Layout>
          <Layout.Section>
            <Card>
              <DataTable
                columnContentTypes={["text", "text", "text"]}
                headings={["Product", "Maintenance Category", "Reminder Interval"]}
                rows={rows}
              />
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
