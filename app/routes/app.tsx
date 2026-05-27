import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate, PLAN_PRO } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  // SKIP_BILLING=true during dev/pre-launch -- Shopify blocks the Billing API
  // for apps not yet publicly listed on the App Store.
  // Remove this env var after App Store listing is approved.
  const skipBilling = process.env.SKIP_BILLING === "true";

  if (!skipBilling) {
    const isTestBilling =
      process.env.BILLING_TEST === "true" ||
      process.env.NODE_ENV !== "production";

    try {
      await billing.require({
        plans: [PLAN_PRO],
        isTest: isTestBilling,
        onFailure: async () =>
          billing.request({
            plan: PLAN_PRO,
            isTest: isTestBilling,
            returnUrl: `${process.env.SHOPIFY_APP_URL}/app`,
          }),
      });
    } catch (e) {
      // Let redirects through (billing.request() throws a redirect Response).
      // Use duck-type check because instanceof Response can fail across module boundaries.
      if (e != null && typeof e === "object" && typeof (e as any).status === "number" && (e as any).headers != null) throw e;
      // If the Shopify billing API returns an unexpected error, log it and
      // allow the app to load rather than crashing with "Application Error".
      console.error("[billing] billing.require() failed:", e);
    }
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
