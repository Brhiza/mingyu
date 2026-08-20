export const AI_CLIENT_ADDRESS_HEADER = 'x-mingyu-client-address';

const DEFAULT_WINDOW_SECONDS = 10 * 60;
const DEFAULT_MAX_REQUESTS = 12;
const MAX_TRACKED_CLIENTS = 10_000;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const builtinAiClients = new Map<string, RateLimitEntry>();

export type AiRateLimitEnv = {
  AI_RATE_LIMIT_MAX_REQUESTS?: string;
  AI_RATE_LIMIT_WINDOW_SECONDS?: string;
};

export type AiRateLimitResult =
  | {
      allowed: true;
      limit: number;
      remaining: number;
      resetAt: number;
    }
  | {
      allowed: false;
      limit: number;
      remaining: 0;
      resetAt: number;
      retryAfterSeconds: number;
    };

export function consumeBuiltinAiRateLimit(
  request: Request,
  env?: AiRateLimitEnv,
  now = Date.now(),
): AiRateLimitResult | null {
  const clientAddress = normalizeClientAddress(request.headers.get(AI_CLIENT_ADDRESS_HEADER));
  if (!clientAddress) return null;

  const limit = readPositiveInteger(env?.AI_RATE_LIMIT_MAX_REQUESTS, DEFAULT_MAX_REQUESTS, 1, 500);
  const windowSeconds = readPositiveInteger(
    env?.AI_RATE_LIMIT_WINDOW_SECONDS,
    DEFAULT_WINDOW_SECONDS,
    10,
    24 * 60 * 60,
  );
  const windowMs = windowSeconds * 1000;
  const current = builtinAiClients.get(clientAddress);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    builtinAiClients.set(clientAddress, { count: 1, resetAt });
    trimExpiredClients(now);
    return { allowed: true, limit, remaining: Math.max(limit - 1, 0), resetAt };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return {
    allowed: true,
    limit,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt,
  };
}

function normalizeClientAddress(value: string | null): string {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 128 || /[\s,]/.test(normalized)) return '';
  return normalized;
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function trimExpiredClients(now: number) {
  if (builtinAiClients.size <= MAX_TRACKED_CLIENTS) return;

  for (const [key, entry] of builtinAiClients) {
    if (entry.resetAt <= now) {
      builtinAiClients.delete(key);
    }
  }

  while (builtinAiClients.size > MAX_TRACKED_CLIENTS) {
    const oldestKey = builtinAiClients.keys().next().value as string | undefined;
    if (!oldestKey) break;
    builtinAiClients.delete(oldestKey);
  }
}
