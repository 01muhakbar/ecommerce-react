type UnauthorizedPayload = {
  status?: number;
  code?: string;
  message?: string;
};

type Callback = (payload?: UnauthorizedPayload) => void;

const listeners = new Set<Callback>();

export function onUnauthorized(callback: Callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function triggerUnauthorized(payload?: UnauthorizedPayload) {
  listeners.forEach((cb) => cb(payload));
}
