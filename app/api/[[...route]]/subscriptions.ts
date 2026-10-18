import crypto from "crypto";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";

import { db } from "@/db/drizzle";
import { subscriptions } from "@/db/schema";

const app = new Hono()
  .get(
    "/current",
    clerkMiddleware(),
    async (c) => {
      const auth = getAuth(c);

      if (!auth?.userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, auth.userId));

      return c.json({ data: subscription || null });
    },
  )
  .post(
    "/checkout",
    clerkMiddleware(),
    async (c) => {
      const auth = getAuth(c);

      if (!auth?.userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const [existing] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, auth.userId));

      if (existing?.status === "active") {
        return c.json({ error: "User is already subscribed" }, 400);
      }

      // Initialize Paystack Transaction
      // Note: You need to create a Plan in Paystack and add its code to your .env.local
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY!}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: auth.sessionClaims?.email || "user@example.com",
          amount: "500000", // e.g., 5000 NGN (Paystack uses kobo/smallest unit)
          plan: process.env.PAYSTACK_PLAN_CODE!, // e.g., PLN_gx2wn530m0i3w3m
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL!}/`,
          metadata: {
            user_id: auth.userId,
          },
        }),
      });

      const checkout = await response.json();

      if (!checkout.status || !checkout.data?.authorization_url) {
        return c.json({ error: "Internal error creating Paystack checkout" }, 500);
      }

      return c.json({ data: checkout.data.authorization_url });
    },
  )
  .post(
    "/webhook",
    async (c) => {
      const text = await c.req.text();
      const signature = c.req.header("x-paystack-signature");

      if (!signature) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Paystack uses HMAC SHA-512 for its signatures
      const hash = crypto
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
        .update(text)
        .digest("hex");

      if (hash !== signature) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const payload = JSON.parse(text);
      const event = payload.event;

      // Handle successful initial charge and renewals
      if (event === "charge.success") {
        const userId = payload.data.metadata?.user_id;
        // If it's a subscription charge, Paystack returns the subscription_code in the plan object
        const subscriptionId = payload.data.plan?.subscription_code || payload.data.reference; 
        const status = "active";

        if (userId) {
          const [existing] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId));

          if (existing) {
            await db
              .update(subscriptions)
              .set({
                status,
                subscriptionId,
              })
              .where(eq(subscriptions.userId, userId));
          } else {
            await db
              .insert(subscriptions)
              .values({
                id: createId(),
                subscriptionId,
                userId,
                status,
              });
          }
        }
      }

      // Handle subscription cancellation
      if (event === "subscription.disable") {
        const subscriptionId = payload.data.subscription_code;
        
        await db
          .update(subscriptions)
          .set({ status: "canceled" })
          .where(eq(subscriptions.subscriptionId, subscriptionId));
      }

      return c.json({}, 200);
    },
  );

export default app;