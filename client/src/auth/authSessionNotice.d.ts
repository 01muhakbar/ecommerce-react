export const DEFAULT_SESSION_EXPIRED_NOTICE: string;

export function storePendingAuthNotice(message?: string): void;
export function readPendingAuthNotice(): string;
export function clearPendingAuthNotice(): void;
export function resolveUnauthorizedNotice(payload?: {
  status?: number;
  code?: string;
  message?: string;
}): string;
