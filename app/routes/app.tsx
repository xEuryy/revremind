import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Billing and access control are handled entirely by Shopify Managed Pricing:
  // a merchant must select the RevRemind Pro plan (with a 14-day trial) on
  // Shopify's hosted pricing page before they can reach the app, and Shopify
  // charges and lapses the subscription on its own. The app therefore does NOT
  // call the Billing API directly (managed pricing and billing.request are
  // mutually exclusive). See app.billing.tsx, which only reads status.
  await authenticate.admin(request);

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">Dashboard</Link>
        <Link to="/app/vehicles">Vehicles</Link>
        <Link to="/app/reminders">Reminders</Link>
        <Link to="/app/products">Products</Link>
        <Link to="/app/settings">Settings</Link>
        <Link to="/app/setup-checkout">Setup Checkout</Link>
        <Link to="/app/billing">Billing</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = boundary.headers;
