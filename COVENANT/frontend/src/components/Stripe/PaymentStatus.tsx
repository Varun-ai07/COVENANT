'use client';

import React from 'react';

interface PaymentStatusProps {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  taskId: string;
  amount?: number;
}

export default function PaymentStatus({ status, taskId, amount }: PaymentStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Payment Pending';
      case 'processing':
        return 'Payment Processing';
      case 'completed':
        return 'Payment Completed';
      case 'failed':
        return 'Payment Failed';
      case 'cancelled':
        return 'Payment Cancelled';
      default:
        return `Payment Status: ${status}`;
    }
  };

  return (
    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
      {getStatusText()}
      {amount && status === 'completed' && (
        <span className="ml-2">
          (${(amount / 100).toFixed(2)})
        </span>
      )}
    </div>
  );
}