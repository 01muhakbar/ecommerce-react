import React from "react";

type State = { hasError: boolean; message?: string };
export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(err: unknown) { return { hasError: true, message: String(err) }; }
  componentDidCatch(err: unknown) { console.error(err); }
  render() {
    if (this.state.hasError) {
      return <div className="p-6 text-red-600">Terjadi kesalahan saat memuat dashboard.</div>;
    }
    return this.props.children;
  }
}