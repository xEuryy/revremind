import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate, PLAN_MONTHLY } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { billing } = await authenticate.admin(request);

    const isTestBilling = process.env.BILLING_TEST === "true" || process.env.NODE_ENV !== "production";

    await billing.require({
      plans: [PLAN_MONTHLY],
      isTest: isTestBilling,
      onFailure: async () =>
        billing.request({
          plan: PLAN_MONTHLY,
          isTest: isTestBilling,
          returnUrl: `${process.env.SHOPIFY_APP_URL}/app`,
        }),
    });
  } catch (error) {
    // Log actual error to Railway for debugging, then re-throw
    if (!(error instanceof Response)) {
      console.error("[RevRemind] Loader error:", error instanceof Error ? error.message : String(error));
      if (error instanceof Error && (error as any).errorData) {
        console.error("[RevRemind] Billing userErrors:", JSON.stringify((error as any).errorData));
      }
      if (error instanceof Error && error.stack) {
        console.error("[RevRemind] Stack:", error.stack);
      }
    }
    throw error;
  }

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
