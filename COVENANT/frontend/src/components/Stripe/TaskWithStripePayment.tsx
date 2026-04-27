'use client';

import React, { useState } from 'react';
import { createTaskCheckoutSession } from '@/lib/stripe';

interface TaskWithStripePaymentProps {
  taskId: string;
  initialTaskData: any;
}

export default function TaskWithStripePayment({ taskId, initialTaskData }: TaskWithStripePaymentProps) {
  const [taskData, setTaskData] = useState(initialTaskData);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const handleCreateTask = async () => {
    setIsProcessing(true);

    try {
      // Create checkout session
      const { clientSecret: secret } = await createTaskCheckoutSession(
        taskId,
        taskData.title,
        taskData.description,
        taskData.budget * 100 // Convert to cents
      );

      setClientSecret(secret);
      setPaymentStatus('processing');
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setPaymentStatus('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="task-payment-container">
      <h2>Create Task with Payment</h2>
      {paymentStatus === 'idle' && (
        <button onClick={handleCreateTask} disabled={isProcessing}>
          {isProcessing ? 'Processing...' : 'Create Task with Payment'}
        </button>
      )}
      {paymentStatus === 'processing' && clientSecret && (
        <div>
          {/* Stripe checkout component would be rendered here */}
        </div>
      )}
      {paymentStatus === 'completed' && (
        <div>Payment completed successfully!</div>
      )}
      {paymentStatus === 'failed' && (
        <div>Payment failed. Please try again.</div>
      )}
    </div>
  );
}