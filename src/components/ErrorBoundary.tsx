import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-xl max-w-lg w-full text-slate-800">
            <h2 className="text-red-600 font-bold text-lg mb-2">Error in {this.props.name || "Component"}</h2>
            <pre className="bg-slate-100 p-2 rounded text-xs overflow-auto max-h-60">
              {this.state.error?.message}
            </pre>
            <button onClick={() => this.setState({ hasError: false })} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg">Try Again</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
