import { NextRequest } from 'next/server';
import { handleStripeWebhook } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await handleStripeWebhook(payload, sig);

    if (result.success) {
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: result.error || 'Webhook handling failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Webhook handling error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook handling failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}