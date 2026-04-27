// Stripe Integration Service for COVENANT
// This service handles all Stripe-related operations for the COVENANT protocol

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

// Initialize Supabase client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Payment thresholds
const PAYMENT_THRESHOLDS = {
  MIN_AMOUNT: 0.50, // $0.50 minimum
  MAX_AMOUNT: 100000, // $100,000 maximum
};

// Supported currencies
const SUPPORTED_CURRENCIES = {
  default: 'usd',
  supported: ['usd', 'eur', 'gbp']
};

/**
 * Create a Stripe checkout session for a COVENANT task
 * @param taskId - The ID of the task being paid for
 * @param amount - The amount in ETH
 * @param description - Description of the task
 * @returns Stripe checkout session ID
 */
export async function createTaskCheckoutSession(
  taskId: string,
  amount: number,
  description: string
): Promise<string> {
  try {
    // Validate amount
    if (amount < PAYMENT_THRESHOLDS.MIN_AMOUNT) {
      throw new Error(`Amount must be at least $${PAYMENT_THRESHOLDS.MIN_AMOUNT}`);
    }

    if (amount > PAYMENT_THRESHOLDS.MAX_AMOUNT) {
      throw new Error(`Amount must be less than $${PAYMENT_THRESHOLDS.MAX_AMOUNT}`);
    }

    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: SUPPORTED_CURRENCIES.default,
            product_data: {
              name: `COVENANT Task Payment #${taskId}`,
              description: `Payment for task #${taskId} in the COVENANT protocol: ${description}`,
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
        taskId: taskId,
        covenantTaskId: taskId,
        paymentType: 'task_payment'
      },
    });

    // Store payment record in database
    const { error } = await supabase.from('payments').insert({
      task_id: taskId,
      stripe_session_id: session.id,
      amount: session.amount_total,
      currency: session.currency,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error("Database error:", error);
      throw new Error("Failed to store payment record");
    }

    return session.id;
  } catch (error) {
    console.error("Stripe checkout error:", error);
    throw error;
  }
}

/**
 * Verify a Stripe payment for a task
 * @param sessionId - Stripe session ID
 * @returns Payment verification result
 */
export async function verifyTaskPayment(sessionId: string): Promise<{ success: boolean; amount?: number; taskId?: string }> {
  try {
    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Check if payment was successful
    if (session.payment_status === 'paid') {
      // Update payment record in database
      const { error } = await supabase.from('payments').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('stripe_session_id', sessionId);

      if (error) {
        console.error("Database error:", error);
        throw new Error("Failed to update payment record");
      }

      return {
        success: true,
        amount: session.amount_total,
        taskId: session.metadata?.taskId
      };
    }

    return { success: false };
  } catch (error) {
    console.error("Payment verification error:", error);
    throw error;
  }
}

/**
 * Refund a Stripe payment for a task
 * @param sessionId - Stripe session ID
 * @param amount - Amount to refund (optional, defaults to full amount)
 * @returns Refund result
 */
export async function refundTaskPayment(
  sessionId: string,
  amount?: number
): Promise<{ success: boolean; refundId?: string }> {
  try {
    // Retrieve the checkout session to get the payment intent
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session.payment_intent) {
      throw new Error("No payment intent found for this session");
    }

    // Retrieve the payment intent to get the charge ID
    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);

    if (!paymentIntent.latest_charge) {
      throw new Error("No charge found for this payment intent");
    }

    // Create refund
    const refundParams: Stripe.RefundCreateParams = {
      charge: paymentIntent.latest_charge as string,
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await stripe.refunds.create(refundParams);

    // Update payment record in database
    const { error } = await supabase.from('payments').update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      refund_id: refund.id
    }).eq('stripe_session_id', sessionId);

    if (error) {
      console.error("Database error:", error);
      throw new Error("Failed to update payment record");
    }

    return {
      success: true,
      refundId: refund.id
    };
  } catch (error) {
    console.error("Payment refund error:", error);
    throw error;
  }
}

/**
 * Get payment status for a task
 * @param taskId - The ID of the task
 * @returns Payment status information
 */
export async function getTaskPaymentStatus(taskId: string): Promise<{
  status: string;
  amount?: number;
  currency?: string;
  sessionId?: string;
}> {
  try {
    // Retrieve payment record from database
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Database error:", error);
      return { status: 'not_found' };
    }

    return {
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      sessionId: data.stripe_session_id
    };
  } catch (error) {
    console.error("Payment status error:", error);
    throw error;
  }
}

/**
 * Handle Stripe webhook events
 * @param req - Next.js request object
 * @returns Webhook response
 */
export async function handleStripeWebhook(req: Request): Promise<{ success: boolean }> {
  try {
    // Get the webhook secret and body
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    const buf = await req.arrayBuffer();
    const sig = req.headers.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        Buffer.from(buf),
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      throw new Error("Webhook Error");
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;

        // Update database with payment confirmation
        const taskId = checkoutSession.metadata?.taskId;
        if (taskId) {
          // Store payment record in database
          const { error } = await supabase.from('payments').update({
            status: 'completed',
            completed_at: new Date().toISOString()
          }).eq('stripe_session_id', checkoutSession.id);

          if (error) {
            console.error("Database error:", error);
            throw new Error("Database error");
          }
        }

        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`PaymentIntent ${paymentIntent.id} succeeded`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`PaymentIntent ${paymentIntent.id} failed`);
        break;
      }

      case 'charge.succeeded': {
        const charge = event.data.object as Stripe.Charge;
        console.log(`Charge ${charge.id} succeeded for ${charge.amount} ${charge.currency}`);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log(`Charge ${charge.id} refunded for ${charge.amount_refunded} ${charge.currency}`);
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return { success: true };
  } catch (err) {
    console.error("Webhook error:", err);
    throw err;
  }
}

export default {
  createTaskCheckoutSession,
  verifyTaskPayment,
  refundTaskPayment,
  getTaskPaymentStatus,
  handleStripeWebhook
};