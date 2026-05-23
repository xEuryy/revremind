import type { LoaderFunctionArgs } from "@remix-run/node";

// Public privacy policy page — no auth required
export const loader = async (_: LoaderFunctionArgs) => {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — RevRemind</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 760px; margin: 48px auto; padding: 0 24px; color: #202223; line-height: 1.6; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 18px; margin-top: 36px; }
    p, li { font-size: 15px; color: #444; }
    a { color: #0070f3; }
    .updated { color: #888; font-size: 13px; margin-bottom: 32px; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: May 23, 2026</p>

  <p>RevRemind ("we", "us", or "our") is a Shopify app that helps automotive parts merchants capture vehicle information at checkout and send automated maintenance reminders to their customers. This Privacy Policy explains what data we collect, how we use it, and how it is protected.</p>

  <h2>1. Data We Collect</h2>
  <p>When a merchant installs RevRemind on their Shopify store, we collect and store the following data in connection with orders placed on that store:</p>
  <ul>
    <li><strong>Vehicle information:</strong> Year, make, and model entered by the customer at checkout (optional field)</li>
    <li><strong>Customer contact information:</strong> Email address and, where provided, phone number — used solely to send maintenance reminder messages</li>
    <li><strong>Order information:</strong> Product name and order date — used to determine the appropriate maintenance reminder schedule</li>
    <li><strong>Merchant store information:</strong> Shopify store domain, sender name, and sender email configured by the merchant in the app settings</li>
  </ul>

  <h2>2. How We Use Data</h2>
  <p>Data collected through RevRemind is used exclusively to:</p>
  <ul>
    <li>Schedule and send maintenance reminder emails and SMS messages to customers on behalf of the merchant</li>
    <li>Personalize reminder message content using the vehicle and product information</li>
    <li>Display vehicle profiles and reminder history in the merchant dashboard</li>
  </ul>
  <p>We do not sell, rent, or share customer data with third parties for advertising or marketing purposes unrelated to the merchant's own reminder campaigns.</p>

  <h2>3. Third-Party Processors</h2>
  <p>To deliver our service, we share data with the following sub-processors, each bound by their own privacy and data security policies:</p>
  <ul>
    <li><strong>SendGrid (Twilio)</strong> — email delivery. Customer email addresses and message content are transmitted to SendGrid to send reminder emails. <a href="https://www.twilio.com/en-us/legal/privacy">Privacy policy</a></li>
    <li><strong>Twilio</strong> — SMS delivery. Customer phone numbers and message content are transmitted to Twilio to send reminder SMS messages (when SMS is enabled by the merchant). <a href="https://www.twilio.com/en-us/legal/privacy">Privacy policy</a></li>
    <li><strong>Anthropic</strong> — AI message generation. Vehicle and product data is sent to Anthropic's Claude API to generate personalized reminder message content. No customer contact information is sent to Anthropic. <a href="https://www.anthropic.com/legal/privacy">Privacy policy</a></li>
    <li><strong>Supabase</strong> — database hosting. All app data (vehicle profiles, reminder records, session data) is stored in a Supabase-hosted PostgreSQL database. <a href="https://supabase.com/privacy">Privacy policy</a></li>
    <li><strong>Railway</strong> — application hosting. The RevRemind application server runs on Railway's infrastructure. <a href="https://railway.app/legal/privacy">Privacy policy</a></li>
  </ul>

  <h2>4. Data Retention and Deletion</h2>
  <p>Merchant and customer data is retained for as long as the merchant's RevRemind subscription is active. When a merchant uninstalls RevRemind, all associated data — including vehicle profiles, reminder records, and customer contact information — is permanently deleted from our systems within 48 hours.</p>
  <p>Customers may request deletion of their data by contacting the merchant who operates the store where their data was collected. Merchants may submit customer data deletion requests to us at the contact address below.</p>

  <h2>5. Data Security</h2>
  <p>We implement industry-standard security practices including encrypted data storage, HTTPS for all data transmission, and token-based authentication for all API endpoints. Access to production data is restricted to authorized personnel only.</p>

  <h2>6. Merchant Responsibilities</h2>
  <p>RevRemind merchants are responsible for ensuring they have the appropriate consent from their customers to send marketing and reminder communications, in accordance with applicable laws (CAN-SPAM, GDPR, CASL, TCPA, etc.). RevRemind provides the technical infrastructure; merchants are the data controllers for their customers' data.</p>

  <h2>7. GDPR Compliance</h2>
  <p>For merchants operating in the European Economic Area, RevRemind processes customer data as a data processor on behalf of the merchant (the data controller). We comply with Shopify's GDPR webhook requirements, including customer data erasure and shop data erasure upon request.</p>

  <h2>8. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. Changes will be posted at this URL with an updated effective date. Continued use of RevRemind after changes constitutes acceptance of the updated policy.</p>

  <h2>9. Contact</h2>
  <p>For privacy-related questions, data deletion requests, or other inquiries, contact us at:</p>
  <p><a href="mailto:michael.d.eury@gmail.com">michael.d.eury@gmail.com</a></p>
</body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
};

// No default export needed — loader handles the full response
