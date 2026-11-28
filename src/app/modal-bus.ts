import type { Method } from '../schema';
import type { BirthPlaceModalOptions } from '../v2-ui/birth-place-modal';

export interface PlaceModalSession {
  key: number;
  options: BirthPlaceModalOptions;
}

export interface InspirationModalSession {
  key: number;
  method?: Method;
  selectedQuestion?: string;
  onSelect: (question: string) => void;
}

export interface TermModalFallback {
  title?: string;
  subtitle?: string;
  category?: string;
  summary?: string;
  detail?: string;
  keywords?: string[];
  advice?: string;
  classicRef?: string;
  preferHexagram?: boolean;
}

export interface TermModalSession {
  key: number;
  query: string;
  fallback?: TermModalFallback;
}

interface ModalBusSnapshot {
  place: PlaceModalSession | null;
  inspiration: InspirationModalSession | null;
  term: TermModalSession | null;
}

let seq = 0;
let snapshot: ModalBusSnapshot = {
  place: null,
  inspiration: null,
  term: null,
};

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeModalBus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getModalBusSnapshot(): ModalBusSnapshot {
  return snapshot;
}

export function openPlaceModalSession(options: BirthPlaceModalOptions): number {
  const key = ++seq;
  snapshot = { ...snapshot, place: { key, options } };
  notify();
  return key;
}

export function closePlaceModalSession(onlyIfKey?: number): void {
  if (!snapshot.place) return;
  if (onlyIfKey !== undefined && snapshot.place.key !== onlyIfKey) return;
  const prev = snapshot.place;
  snapshot = { ...snapshot, place: null };
  notify();
  prev.options.onClose?.();
}

export function isPlaceModalSessionOpen(key?: number): boolean {
  if (!snapshot.place) return false;
  return key === undefined ? true : snapshot.place.key === key;
}

export function openQuestionInspirationSession(
  params: Omit<InspirationModalSession, 'key'>,
): void {
  const key = ++seq;
  snapshot = { ...snapshot, inspiration: { key, ...params } };
  notify();
}

export function closeQuestionInspirationSession(): void {
  if (!snapshot.inspiration) return;
  snapshot = { ...snapshot, inspiration: null };
  notify();
}

export function openTermModalSession(query: string, fallback?: TermModalFallback): void {
  const cleaned = query.trim();
  if (!cleaned) return;
  const key = ++seq;
  snapshot = { ...snapshot, term: { key, query: cleaned, fallback } };
  notify();
}

export function closeTermModalSession(): void {
  if (!snapshot.term) return;
  snapshot = { ...snapshot, term: null };
  notify();
}
