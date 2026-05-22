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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // Pull products from Shopify
  const response = await admin.graphql(`
    query {
      products(first: 100) {
        edges {
          node {
            id
            title
            status
          }
        }
      }
    }
  `);

  const data = await response.json();
  const shopifyProducts = data.data.products.edges.map((e: any) => e.node);

  // Get already-categorized products
  const tracked = await prisma.trackedProduct.findMany({ where: { shop } });
  const trackedMap = Object.fromEntries(
    tracked.map((p) => [p.shopifyProductId, p])
  );

  return json({ shopifyProducts, trackedMap });
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
  const { shopifyProducts, trackedMap } = useLoaderData<typeof loader>();
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
