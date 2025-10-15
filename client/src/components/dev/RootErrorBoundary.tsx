import { Component } from "react";
import type { ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error?: any };

export default class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // log lengkap di console
    // eslint-disable-next-line no-console
    console.error("[RootErrorBoundary] Caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-red-700">
          <h1 className="text-xl font-semibold mb-2">
            Aplikasi mengalami error.
          </h1>
          <p className="mb-3">
            Lihat detail di <strong>Console</strong> agar bisa diperbaiki cepat.
          </p>
          <pre className="rounded bg-red-50 p-3 overflow-auto text-sm">
            {String(
              this.state.error?.message ?? this.state.error ?? "Unknown error"
            )}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
