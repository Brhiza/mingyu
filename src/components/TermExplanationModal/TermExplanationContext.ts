import { createContext, useContext } from 'react';
import type { TermContextData } from '@/lib/metaphysics-terms';

export type { TermContextData };

export interface TermExplanationContextValue {
  openTerm: (term: string, context?: TermContextData) => void;
}

export const TermExplanationContext = createContext<TermExplanationContextValue>({
  openTerm: () => {},
});

export function useMetaphysicsTermModal() {
  return useContext(TermExplanationContext);
}
