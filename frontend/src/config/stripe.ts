// Stripe environment configuration
export const STRIPE_CONFIG = {
  // Publishable key for client-side (frontend)
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,

  // Secret key for server-side operations
  secretKey: process.env.STRIPE_SECRET_KEY,

  // Webhook secret for verifying webhook events
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

  // Supported currencies
  currencies: {
    default: 'usd',
    supported: ['usd', 'eur', 'gbp']
  },

  // Payment thresholds
  minAmount: 0.50, // $0.50 minimum
  maxAmount: 100000, // $1,000,000 maximum
};

// Validate required environment variables
export const validateStripeConfig = () => {
  const requiredVars = [
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ];

  const missingVars = requiredVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingVars.length > 0) {
    console.warn('Missing Stripe environment variables:', missingVars);
    return false;
  }

  return true;
};

export default {
  STRIPE_CONFIG,
  validateStripeConfig
};