import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  // Verify Paystack Webhook Signature
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest("hex");

  if (hash !== signature) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(body);

  // Handle successful charge
  if (event.event === "charge.success") {
    const userId = event.data.metadata?.userId;
    // Database logic: Mark subscription as active for userId here
  }

  return new NextResponse("OK", { status: 200 });
}