import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(request: NextRequest) {
  try {
    const { taskId, amount } = await request.json();

    // Validate input
    if (!taskId || !amount) {
      return NextResponse.json({ error: "Task ID and amount are required" }, { status: 400 });
    }

    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `COVENANT Task Payment #${taskId}`,
              description: `Payment for task #${taskId} in the COVENANT protocol`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/tasks/${taskId}?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/tasks/${taskId}?payment=cancelled`,
      metadata: {
        taskId: taskId.toString(),
        covenantTaskId: taskId.toString(),
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}