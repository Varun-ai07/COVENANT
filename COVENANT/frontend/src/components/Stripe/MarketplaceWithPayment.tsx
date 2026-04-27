'use client';

import React, { useState } from 'react';

interface MarketplaceWithPaymentProps {
  tasks: any[];
}

export default function MarketplaceWithPayment({ tasks }: MarketplaceWithPaymentProps) {
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'eth' | 'stripe'>('eth');

  const handlePaymentMethodChange = (method: 'eth' | 'stripe') => {
    setPaymentMethod(method);
  };

  return (
    <div className="marketplace-payment">
      <h2>Marketplace with Payment Options</h2>
      <div className="payment-options">
        <button
          className={paymentMethod === 'eth' ? 'active' : ''}
          onClick={() => handlePaymentMethodChange('eth')}
        >
          Pay with ETH
        </button>
        <button
          className={paymentMethod === 'stripe' ? 'active' : ''}
          onClick={() => handlePaymentMethodChange('stripe')}
        >
          Pay with Stripe
        </button>
      </div>

      <div className="task-list">
        {tasks.map((task) => (
          <div key={task.id} className="task-item">
            <h3>{task.title}</h3>
            <p>{task.description}</p>
            <div className="payment-info">
              {paymentMethod === 'stripe' ? (
                <span>Pay with Stripe: ${task.budget}</span>
              ) : (
                <span>Pay with ETH: {task.budget} ETH</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}