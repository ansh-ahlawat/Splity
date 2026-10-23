import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fafbfa] flex items-center justify-center p-4">
          <div className="card-base p-8 max-w-md w-full text-center space-y-4 rounded-3xl border border-red-200 bg-white">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Something went wrong</h2>
              <p className="text-xs text-gray-500 font-light">
                An unexpected interface error occurred. Your financial records in AWS DynamoDB remain completely safe.
              </p>
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="btn-primary mx-auto text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Splity</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
