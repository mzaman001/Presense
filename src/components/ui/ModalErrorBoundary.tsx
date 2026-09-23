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
    error: null,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[rgba(248,113,113,0.2)] bg-[var(--color-surface)] p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold text-[#F87171]">
              Modal Error
            </h2>
            <p className="mb-4 text-sm text-[var(--color-text-3)]">
              There was a problem loading the {this.props.modalName}.
            </p>
            <div className="flex justify-end gap-2">
              {this.props.onClose && (
                <button
                  onClick={this.props.onClose}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 text-sm text-[var(--color-text-1)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  Close
                </button>
              )}
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-[var(--color-background)] transition-opacity hover:opacity-90"
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
