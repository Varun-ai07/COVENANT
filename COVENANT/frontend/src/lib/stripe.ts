import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Create a Stripe checkout session for a task
 */
export async function createTaskCheckoutSession(
  taskId: string,
  title: string,
  description: string,
  amount: number
) {
  try {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Task Payment: ${title}`,
              description: description,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/tasks/${taskId}?status=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/tasks/${taskId}?status=cancelled`,
      metadata: {
        taskId: taskId,
      },
    });

    // Store payment record in database
    const { error } = await supabase
      .from('payments')
      .insert({
        task_id: taskId,
        stripe_session_id: session.id,
        amount: amount,
        currency: 'usd',
        status: 'pending',
        created_at: new Date(),
      });

    if (error) {
      console.error('Error storing payment record:', error);
    }

    return {
      sessionId: session.id,
      clientSecret: session.client_secret,
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

/**
 * Verify task payment completion
 */
export async function verifyTaskPayment(taskId: string) {
  try {
    // Get payment record from database
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('task_id', taskId)
      .single();

    if (error) {
      console.error('Error fetching payment record:', error);
      return false;
    }

    if (!data) {
      return false;
    }

    // Check if payment is completed
    return data.status === 'completed';
  } catch (error) {
    console.error('Error verifying task payment:', error);
    throw error;
  }
}

/**
 * Process payment refund
 */
export async function refundTaskPayment(paymentId: string, reason: string) {
  try {
    // Get payment record
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('stripe_session_id')
      .eq('id', paymentId)
      .single();

    if (fetchError) {
      throw new Error(`Error fetching payment: ${fetchError.message}`);
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_session_id,
      reason: reason as any,
    });

    // Update payment status in database
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'refunded',
        refunded_at: new Date(),
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Error updating payment status:', updateError);
    }

    return refund;
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
}

/**
 * Get task payment status
 */
export async function getTaskPaymentStatus(taskId: string) {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching payment status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting task payment status:', error);
    throw error;
  }
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(payload: string, sig: string) {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;

        // Update payment status to completed
        const { error } = await supabase
          .from('payments')
          .update({ status: 'completed' })
          .eq('stripe_session_id', session.id);

        if (error) {
          console.error('Error updating payment status:', error);
        }
        break;

      case 'payment_intent.succeeded':
        // Handle successful payment
        break;

      case 'payment_intent.payment_failed':
        // Handle failed payment
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Webhook handling error:', error);
    return { success: false, error: error.message };
  }
}