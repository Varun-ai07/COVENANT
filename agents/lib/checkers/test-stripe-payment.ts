// Test file for Stripe integration verification
import { check as checkStripePayment } from "./StripePaymentChecker.js";

// Mock test data
const mockDeliverable = {
  stripeSessionId: "test_session_id_123",
  paymentAmount: 1000, // $10.00 in cents
  paymentUrl: "https://api.stripe.com/v1/payment_intents"
};

// Test the Stripe payment checker
async function testStripePaymentChecker() {
  console.log("Testing Stripe Payment Checker...");

  try {
    const result = await checkStripePayment(mockDeliverable);
    console.log("Stripe Payment Checker Result:", result);

    if (result.passed) {
      console.log("✓ Stripe payment verification successful");
      console.log(`Score: ${result.score}/100`);
      console.log(`Details: ${result.details}`);
      console.log("Evidence:", result.evidence);
    } else {
      console.log("✗ Stripe payment verification failed");
    }
  } catch (error) {
    console.error("Error testing Stripe payment checker:", error);
  }
}

// Run the test
testStripePaymentChecker();