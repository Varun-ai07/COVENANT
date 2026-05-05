"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { NeonButton } from "./NeonButton";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
          <div className="glass-card p-8 max-w-md text-center space-y-4">
            <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
            <h3 className="font-heading text-xl text-white">Something went wrong</h3>
            <p className="font-body text-sm text-gray-400">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <NeonButton
              variant="secondary"
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.reload();
              }}
            >
              <RefreshCw size={16} />
              Reload Page
            </NeonButton>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
