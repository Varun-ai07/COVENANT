"use client";

import { useState, useEffect } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { useAccount } from "wagmi";
import { useToast } from "@/components/Toast";

interface StripeCheckoutProps {
  taskId: bigint;
  amount: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function StripeCheckout({ taskId, amount, onSuccess, onError }: StripeCheckoutProps) {
  const { isConnected } = useAccount();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [stripe, setStripe] = useState<Stripe | null>(null);

  // Initialize Stripe
  useEffect(() => {
    const initializeStripe = async () => {
      try {
        const stripeInstance = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
        setStripe(stripeInstance);
      } catch (error) {
        console.error("Failed to initialize Stripe:", error);
        addToast({
          type: "error",
          title: "Payment Error",
          message: "Failed to initialize payment system"
        });
      }
    };

    if (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      initializeStripe();
    }
  }, []);

  const handleCheckout = async () => {
    if (!isConnected) {
      addToast({
        type: "error",
        title: "Wallet Required",
        message: "Please connect your wallet first"
      });
      return;
    }

    if (!stripe) {
      addToast({
        type: "error",
        title: "Payment System Error",
        message: "Payment system not initialized. Please refresh the page."
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create a checkout session on the backend
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: taskId.toString(),
          amount: parseFloat(amount),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (error) {
        console.error("Stripe checkout error:", error);
        addToast({
          type: "error",
          title: "Checkout Error",
          message: error.message || "Failed to process payment"
        });
      }
    } catch (error) {
      console.error("Checkout error:", error);
      addToast({
        type: "error",
        title: "Payment Failed",
        message: error instanceof Error ? error.message : "Failed to process payment"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={isLoading || !stripe}
      className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-glow-violet transition-all duration-300 flex items-center gap-2 disabled:opacity-50"
    >
      {isLoading ? (
        <>
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2a10 10 0 00-10 10h2zm2 5.291A7.962 7.962 0 014 12H2c0 5.523 4.477 10 10 10v-2a8 8 0 01-8-8v0z"></path>
          </svg>
          Processing...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Pay with Stripe
        </>
      )}
    </button>
  );
}