type Callback = () => void;

const listeners = new Set<Callback>();

export function onUnauthorized(callback: Callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function triggerUnauthorized() {
  listeners.forEach((cb) => cb());
}
