'use client';

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface StripeCheckoutProps {
  taskId: string;
  amount: number;
  clientSecret: string;
}

export default function StripeCheckout({ taskId, amount, clientSecret }: StripeCheckoutProps) {
  const [stripe, setStripe] = useState<any>(null);

  React.useEffect(() => {
    // Load Stripe when component mounts
    loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!).then(setStripe);
  }, []);

  const fetchClientSecret = async () => {
    // Create a Checkout Session
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId,
        amount,
      }),
    });
    const { clientSecret } = await response.json();
    return clientSecret;
  };

  return (
    <div id="checkout">
      {stripe && clientSecret ? (
        <Elements stripe={stripe}>
          <EmbeddedCheckoutProvider stripe={stripe} options={{clientSecret}} />
        </Elements>
      ) : (
        <div className="text-center py-8">
          <p>Loading payment interface...</p>
        </div>
      )}
    </div>
  );
}