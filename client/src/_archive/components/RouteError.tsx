// client/src/components/RouteError.tsx
import { useRouteError, isRouteErrorResponse } from "react-router-dom";
export default function RouteError() {
  const err = useRouteError() as any;
  if (isRouteErrorResponse(err)) {
    return <div style={{padding:24}}>
      <h2>Unexpected Application Error</h2>
      <pre>{err.status} {err.statusText}</pre>
      <pre>{err.data?.message || ""}</pre>
    </div>;
  }
  return <div style={{padding:24}}>
    <h2>Unexpected Application Error</h2>
    <pre>{err?.message || String(err)}</pre>
  </div>;
}