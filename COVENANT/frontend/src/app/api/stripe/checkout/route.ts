import { NextRequest } from 'next/server';
import { createTaskCheckoutSession } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { taskId, title, description, amount } = await req.json();

    // Validate required fields
    if (!taskId || !title || !description || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create checkout session
    const { clientSecret } = await createTaskCheckoutSession(
      taskId,
      title,
      description,
      amount
    );

    return new Response(
      JSON.stringify({ clientSecret }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}