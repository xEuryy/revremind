import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { processDueReminders } from "../lib/reminder-engine.server";

// Called daily by Railway cron job
// Secured by a shared secret token
export const action = async ({ request }: ActionFunctionArgs) => {
  const authHeader = request.headers.get("Authorization");
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await processDueReminders();
    return json({ ok: true, processed: true });
  } catch (error) {
    console.error("Cron job failed:", error);
    return json({ error: "Processing failed" }, { status: 500 });
  }
};
