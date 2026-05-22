import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
const SHOP = "revremind-dev.myshopify.com";
const API_VERSION = "2024-10";

async function gql(token, query, variables = {}) {
  const res = await fetch(
    `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  return res.json();
}

async function main() {
  const session = await prisma.session.findFirst({
    where: { shop: SHOP, isOnline: false },
  });
  if (!session) throw new Error("No offline session found for " + SHOP);
  console.log("Got session for", SHOP);

  // Step 1: get checkout profiles
  const profiles = await gql(session.accessToken, `{
    checkoutProfiles(first: 5) {
      edges { node { id name isPublished } }
    }
  }`);
  console.log("\nCheckout profiles:");
  console.log(JSON.stringify(profiles?.data?.checkoutProfiles, null, 2));

  const profile = profiles?.data?.checkoutProfiles?.edges?.[0]?.node;
  if (!profile) throw new Error("No checkout profile found");
  console.log("\nUsing profile:", profile.id, "-", profile.name);

  // Step 2: find all checkout-related mutations
  const mutIntrospect = await gql(session.accessToken, `{
    __schema {
      mutationType {
        fields { name }
      }
    }
  }`);
  const allMutations = mutIntrospect?.data?.__schema?.mutationType?.fields ?? [];
  const checkoutMuts = allMutations.filter(f => f.name.toLowerCase().includes("checkout"));
  console.log("\nCheckout-related mutations:");
  checkoutMuts.forEach(f => console.log(" -", f.name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
