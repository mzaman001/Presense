import React, { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  modalName: string;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ModalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(`Error in modal ${this.props.modalName}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[rgba(248,113,113,0.2)] bg-[var(--color-surface)] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-[#F87171] mb-2">Modal Error</h2>
            <p className="text-sm text-[var(--color-text-3)] mb-4">
              There was a problem loading the {this.props.modalName}.
            </p>
            <div className="flex gap-2 justify-end">
              {this.props.onClose && (
                <button
                  onClick={this.props.onClose}
                  className="px-4 py-2 text-sm text-[var(--color-text-1)] bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                >
                  Close
                </button>
              )}
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 text-sm text-[var(--color-background)] bg-[var(--accent)] rounded-lg hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
