// Centralized error handling utility for the COVENANT frontend
import { toast } from "react-hot-toast";

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Custom error types
export class CovenantError extends Error {
  constructor(
    message: string,
    public code?: string,
    public severity: ErrorSeverity = 'medium'
  ) {
    super(message);
    this.name = 'CovenantError';
  }
}

// Error handler configuration
interface ErrorHandlerConfig {
  showToasts: boolean;
  logToConsole: boolean;
  logToAnalytics?: (error: Error, context?: Record<string, any>) => void;
}

// Default configuration
const defaultConfig: ErrorHandlerConfig = {
  showToasts: true,
  logToConsole: true,
};

let errorHandlerConfig: ErrorHandlerConfig = { ...defaultConfig };

// Initialize error handler with custom configuration
export function initErrorHandler(config: Partial<ErrorHandlerConfig> = {}) {
  errorHandlerConfig = { ...defaultConfig, ...config };
}

// Handle error and provide user feedback
export function handleError(
  error: Error | string,
  context?: {
    userMessage?: string;
    severity?: ErrorSeverity;
    operation?: string;
    metadata?: Record<string, any>;
  }
): void {
  // Convert string errors to Error objects
  const errorObj = typeof error === 'string' ? new Error(error) : error;

  // Log to console if enabled
  if (errorHandlerConfig.logToConsole) {
    console.error('Covenant Error:', {
      message: errorObj.message,
      name: errorObj.name,
      stack: errorObj.stack,
      ...context,
    });
  }

  // Show toast notification if enabled
  if (errorHandlerConfig.showToasts) {
    const message = context?.userMessage || errorObj.message || 'An unexpected error occurred';
    const severity = context?.severity || 'medium';

    const toastOptions = {
      low: { icon: 'ℹ️' },
      medium: { icon: '⚠️' },
      high: { icon: '❗' },
      critical: { icon: '‼️' }
    };

    toast.error(`${toastOptions[severity].icon} ${message}`, {
      duration: severity === 'critical' || severity === 'high' ? 6000 : 4000,
      position: 'bottom-right',
    });
  }

  // Log to analytics if configured
  if (errorHandlerConfig.logToAnalytics && context?.metadata) {
    errorHandlerConfig.logToAnalytics(errorObj, context.metadata);
  }
}

// Handle contract interaction errors specifically
export function handleContractError(
  error: any,
  operation: string
): void {
  let userMessage = 'Transaction failed';
  let severity: ErrorSeverity = 'medium';

  // Parse common contract errors
  if (error.code === 4001) {
    userMessage = 'Transaction rejected in wallet';
    severity = 'low';
  } else if (error.code === -32603) {
    userMessage = 'Network error - check your connection';
    severity = 'high';
  } else if (error.message?.includes('insufficient funds')) {
    userMessage = 'Insufficient funds for transaction';
    severity = 'high';
  } else if (error.message?.includes('revert')) {
    userMessage = 'Transaction would fail - check contract conditions';
    severity = 'high';
  } else if (error.message?.includes('gas')) {
    userMessage = 'Gas estimation failed - check transaction parameters';
    severity = 'high';
  }

  handleError(error, {
    userMessage,
    severity,
    operation,
  });
}

// Handle API errors
export function handleAPIError(
  error: any,
  operation: string
): void {
  let userMessage = 'API request failed';
  let severity: ErrorSeverity = 'medium';

  if (error.response?.status === 404) {
    userMessage = 'Resource not found';
    severity = 'low';
  } else if (error.response?.status === 429) {
    userMessage = 'Rate limit exceeded - please try again later';
    severity = 'medium';
  } else if (error.response?.status >= 500) {
    userMessage = 'Server error - please try again later';
    severity = 'high';
  }

  handleError(error, {
    userMessage,
    severity,
    operation,
  });
}

// Handle IPFS errors
export function handleIPFSError(
  error: any,
  operation: string
): void {
  let userMessage = 'IPFS operation failed';
  let severity: ErrorSeverity = 'medium';

  if (error.message?.includes('rate limit')) {
    userMessage = 'IPFS rate limit exceeded';
    severity = 'medium';
  } else if (error.message?.includes('timeout')) {
    userMessage = 'IPFS upload timeout - check file size';
    severity = 'medium';
  } else if (error.message?.includes('unavailable')) {
    userMessage = 'IPFS service unavailable';
    severity = 'high';
  }

  handleError(error, {
    userMessage,
    severity,
    operation,
  });
}

// Success notification utility
export function showSuccess(message: string, duration?: number): void {
  if (errorHandlerConfig.showToasts) {
    toast.success(`✅ ${message}`, {
      duration: duration || 4000,
      position: 'bottom-right',
    });
  }
}

// Info notification utility
export function showInfo(message: string, duration?: number): void {
  if (errorHandlerConfig.showToasts) {
    toast(`ℹ️ ${message}`, {
      duration: duration || 4000,
      position: 'bottom-right',
    });
  }
}

export default {
  handleError,
  handleContractError,
  handleAPIError,
  handleIPFSError,
  showSuccess,
  showInfo,
  initErrorHandler,
};