# COVENANT Stripe Integration Documentation

## Overview

This document describes the complete Stripe integration for the COVENANT protocol, enabling users to pay for tasks using credit/debit cards through Stripe in addition to the existing ETH payment system.

## Architecture

The integration consists of:

1. **Frontend Components** - UI components for payment selection and processing
2. **Backend Services** - API endpoints for creating checkout sessions and handling webhooks
3. **Database Schema** - Payment tracking and status management
4. **Smart Contract Integration** - Linking Stripe payments to on-chain task execution

## Components

### 1. Frontend Components

Located in `frontend/src/components/Stripe/`:

- `StripeCheckout.tsx` - Main checkout component
- `PaymentStatus.tsx` - Payment status display component
- `TaskWithStripePayment.tsx` - Task creation with payment processing
- `MarketplaceWithPayment.tsx` - Marketplace integration with payment options

### 2. Backend Services

Located in `frontend/src/app/api/stripe/`:

- `checkout/route.ts` - Creates Stripe checkout sessions
- `webhook/route.ts` - Handles Stripe webhook events

### 3. Library Functions

Located in `frontend/src/lib/stripe.ts`:

- `createTaskCheckoutSession()` - Creates checkout session for a task
- `verifyTaskPayment()` - Verifies payment completion
- `refundTaskPayment()` - Processes payment refunds
- `getTaskPaymentStatus()` - Retrieves payment status
- `handleStripeWebhook()` - Processes webhook events

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env.local` file:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 2. Database Setup

Run the SQL schema in `frontend/src/lib/stripe-schema.sql` in your Supabase database.

### 3. Webhook Configuration

Set up the following webhook in your Stripe dashboard:

- **Endpoint URL**: `https://your-domain.com/api/stripe/webhook`
- **Events to send**: 
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.succeeded`
  - `charge.refunded`

## Payment Flow

1. User selects a worker and creates a task in the marketplace
2. User chooses "Stripe Payment" as payment method
3. System creates a Stripe checkout session
4. User is redirected to Stripe Checkout to complete payment
5. On successful payment, webhook updates database
6. Task is created on-chain with payment confirmation

## Security Considerations

1. All Stripe operations use proper API keys and webhook secrets
2. Webhook signatures are verified to prevent tampering
3. Payment amounts are validated before processing
4. Database operations are protected against injection
5. All sensitive operations occur server-side

## Error Handling

The system handles various error conditions:

- Invalid payment amounts
- Failed Stripe operations
- Webhook verification failures
- Database errors
- Network connectivity issues

## Testing

To test the integration:

1. Use Stripe's test mode with test card numbers
2. Test successful payments (4242 4242 4242 4242)
3. Test failed payments (4000 0000 0000 0002)
4. Test webhook handling with Stripe CLI

## Future Enhancements

1. Support for additional payment methods
2. Recurring payment subscriptions
3. Multi-currency support
4. Advanced refund and dispute handling
5. Integration with more e-commerce features